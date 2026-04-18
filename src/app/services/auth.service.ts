import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { RateLimiterService, RATE_LIMITS } from './rate-limiter.service';
import { environment } from '../../enviroments/enviroment';
import type { ApiResponse } from '../models/api-response.model';
import type { Session, User } from '@supabase/supabase-js';

// ── Catálogo de permisos ─────────────────────────────────────────────────────
export const ALL_PERMISSIONS = [
    'group:create', 'group:edit', 'group:delete', 'group:view', 'group:add',
    'group:add_member', 'group:remove_member',
    'ticket:create', 'ticket:edit', 'ticket:delete', 'ticket:view', 'ticket:add',
    'ticket:assign', 'ticket:change_status', 'ticket:edit_state', 'ticket:comment',
    'user:create', 'user:edit', 'user:add', 'user:delete', 'user:view',
    'users:view', 'user:manage_permissions',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export interface AppUser {
    id: string;
    username: string;
    email: string;
    fullName: string;
    puesto?: string;
    groupId?: string;
    permissions?: Permission[];
}

/** Fila de la tabla public.users — esquema real */
export interface DbUser {
    id: string;
    full_name: string;
    email: string;
    group_id: string | null;
    puesto: string | null;
}

/** Fila de la tabla public.permissions */
export interface DbPermission {
    id?: string;
    group_id: string;
    resource: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

/** Fila de la tabla public.groups */
export interface DbGroup {
    id: string;
    name: string;
    description: string | null;
}

// ── Helper: genera intOpCode ────────────────────────────────────────────────
function opCode(resource: string, status: number): string {
    const tag = resource.substring(0, 2).toUpperCase();
    return `Sx${tag}${status}`;
}

function respond<T>(statusCode: number, resource: string, data: T): ApiResponse<T> {
    return { statusCode, intOpCode: opCode(resource, statusCode), data };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    /** Usuario reactivo actual (null = no autenticado) */
    currentUser = signal<AppUser | null>(null);

    private sb          = inject(SupabaseService);
    private supabase    = this.sb.client;          // solo para Auth
    private http        = inject(HttpClient);
    private rateLimiter = inject(RateLimiterService);

    /** Base URL del API Gateway (Railway) */
    private gw = environment.apiGatewayUrl;

    constructor() {
        // Restaurar sesión al cargar la app
        this.supabase.auth.getSession().then(({ data }) => {
            if (data.session) this.hydrateUser(data.session);
        });

        // Mantenerse sincronizado con cambios de sesión
        this.supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                this.hydrateUser(session);
            } else {
                this.currentUser.set(null);
            }
        });
    }

    // ── Login con email + password ──────────────────────────────────────────────
    // El login usa Supabase Auth SDK (necesario para JWT y refresh tokens)
    async login(email: string, password: string): Promise<ApiResponse<AppUser | null>> {
        const limit = this.rateLimiter.attempt('login', RATE_LIMITS.LOGIN);
        if (limit.isBlocked) {
            console.warn(`[RateLimit] Login bloqueado. Reintenta en ${limit.retryAfterSeconds}s`);
            return respond(429, 'users', null);
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

        if (error || !data.session) {
            return respond(401, 'users', null);
        }

        this.rateLimiter.reset('login');
        await this.hydrateUser(data.session);
        return respond(200, 'users', this.currentUser());
    }

    // ── Registro de nuevo usuario ───────────────────────────────────────────────
    async register(
        email: string,
        password: string,
        fullName: string,
        username: string
    ): Promise<ApiResponse<{ userId: string } | null>> {
        const limit = this.rateLimiter.attempt('register', RATE_LIMITS.REGISTER);
        if (limit.isBlocked) {
            console.warn(`[RateLimit] Registro bloqueado. Reintenta en ${limit.retryAfterSeconds}s`);
            return respond(429, 'users', null);
        }

        // 1. Crear usuario en Supabase Auth
        const { data, error: sbError } = await this.supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, username } },
        });

        if (sbError) {
            console.error('[Supabase Auth ERROR]:', sbError.message);
            // Si el error es por email confirmation o ya existe, lo reportamos mejor
            return respond(400, 'users', null);
        }

        // 2. Insertar perfil en la tabla `users` via gateway
        if (data.user) {
            try {
                await firstValueFrom(
                    this.http.post(
                        `${this.gw}/api/rest/v1/users`,
                        { 
                          id: data.user.id, 
                          email, 
                          full_name: fullName, 
                          password_hash: password // Nota: esto se guarda en plano, el hash real lo tiene Supabase Auth
                        },
                        { headers: { 'Prefer': 'return=minimal' } }
                    )
                );
            } catch (e: any) {
                console.error('❌ Error insertando perfil en tabla public.users:', e.error?.message || e.message);
                // Si falla aquí, es probable que sea por RLS o falta de políticas en Supabase
            }
        }

        return respond(201, 'users', { userId: data.user?.id ?? '' });
    }

    // ── Logout ──────────────────────────────────────────────────────────────────
    async logout(): Promise<void> {
        await this.supabase.auth.signOut();
        this.rateLimiter.resetAll();
        this.currentUser.set(null);
    }

    isLoggedIn(): boolean {
        return this.currentUser() !== null;
    }

    // ── Obtener todos los usuarios ──────────────────────────────────────────────
    // Petición via API Gateway → Railway → Supabase
    async getUsers(): Promise<ApiResponse<DbUser[] | null>> {
        try {
            const params = new HttpParams().set('select', 'id,full_name,email,group_id,puesto').set('order', 'full_name');
            const data = await firstValueFrom(
                this.http.get<DbUser[]>(`${this.gw}/api/rest/v1/users`, { params })
            );
            return respond(200, 'users', data ?? []);
        } catch {
            return respond(500, 'users', null);
        }
    }

    // ── Obtener todos los grupos ────────────────────────────────────────────────
    async getGroups(): Promise<ApiResponse<DbGroup[] | null>> {
        try {
            const params = new HttpParams().set('select', 'id,name,description').set('order', 'name');
            const data = await firstValueFrom(
                this.http.get<DbGroup[]>(`${this.gw}/api/rest/v1/groups`, { params })
            );
            return respond(200, 'groups', data ?? []);
        } catch {
            return respond(500, 'groups', null);
        }
    }

    // ── Actualizar group_id de un usuario ──────────────────────────────────────
    async updateUserGroup(userId: string, groupId: string | null): Promise<ApiResponse<null>> {
        try {
            const params = new HttpParams().set('id', `eq.${userId}`);
            await firstValueFrom(
                this.http.patch(`${this.gw}/api/rest/v1/users`, { group_id: groupId }, { params })
            );
            return respond(200, 'users', null);
        } catch {
            return respond(500, 'users', null);
        }
    }

    // ── Actualizar datos completos de un usuario ────────────────────────────────
    async updateUser(
        userId: string,
        payload: Partial<Pick<DbUser, 'full_name' | 'group_id' | 'puesto'>>
    ): Promise<ApiResponse<DbUser | null>> {
        try {
            const params = new HttpParams().set('id', `eq.${userId}`);
            const rows = await firstValueFrom(
                this.http.patch<DbUser[]>(`${this.gw}/api/rest/v1/users`, payload, {
                    params,
                    headers: { 'Prefer': 'return=representation' },
                })
            );
            const data = Array.isArray(rows) ? rows[0] : rows;
            return respond(200, 'users', data as DbUser);
        } catch {
            return respond(500, 'users', null);
        }
    }

    // ── Obtener permisos de un grupo ─────────────────────────────────────────────
    async getGroupPermissions(groupId: string): Promise<ApiResponse<DbPermission[] | null>> {
        try {
            const params = new HttpParams()
                .set('select', 'id,group_id,resource,can_view,can_create,can_edit,can_delete')
                .set('group_id', `eq.${groupId}`);
            const data = await firstValueFrom(
                this.http.get<DbPermission[]>(`${this.gw}/api/rest/v1/permissions`, { params })
            );
            return respond(200, 'permissions', data ?? []);
        } catch {
            return respond(500, 'permissions', null);
        }
    }

    // ── Actualizar una fila de permiso (toggle individual) ───────────────────
    async updatePermission(
        permissionId: string,
        changes: Partial<Pick<DbPermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>>
    ): Promise<ApiResponse<null>> {
        try {
            const params = new HttpParams().set('id', `eq.${permissionId}`);
            await firstValueFrom(
                this.http.patch(`${this.gw}/api/rest/v1/permissions`, changes, { params })
            );
            return respond(200, 'permissions', null);
        } catch {
            return respond(500, 'permissions', null);
        }
    }

    // ── Crear o actualizar fila de permiso para un grupo + recurso ───────────
    async upsertPermission(
        groupId: string,
        resource: string,
        perms: { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }
    ): Promise<ApiResponse<DbPermission | null>> {
        try {
            const url = `${this.gw}/api/rest/v1/permissions?on_conflict=group_id,resource`;
            const rows = await firstValueFrom(
                this.http.post<DbPermission[]>(
                    url,
                    { group_id: groupId, resource, ...perms },
                    { headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' } }
                )
            );
            const data = Array.isArray(rows) ? rows[0] : rows;
            return respond(200, 'permissions', data as DbPermission);
        } catch {
            return respond(500, 'permissions', null);
        }
    }

    // ── Eliminar usuario de la tabla users ───────────────────────────────────
    async deleteUser(userId: string): Promise<ApiResponse<null>> {
        try {
            const params = new HttpParams().set('id', `eq.${userId}`);
            await firstValueFrom(
                this.http.delete(`${this.gw}/api/rest/v1/users`, { params })
            );
            return respond(200, 'users', null);
        } catch {
            return respond(500, 'users', null);
        }
    }

    // ── Carga el perfil completo desde la tabla `users` ─────────────────────────
    // hydrateUser usa el gateway para obtener perfil y permisos
    async hydrateUser(session: Session | any): Promise<void> {
        const authUser: User = session.user;

        try {
            // Perfil del usuario via gateway
            const profileParams = new HttpParams()
                .set('select', 'id,full_name,email,group_id,puesto')
                .set('id', `eq.${authUser.id}`);
            const profiles = await firstValueFrom(
                this.http.get<DbUser[]>(`${this.gw}/api/rest/v1/users`, { params: profileParams })
            );
            const profile = profiles?.[0] ?? null;

            // Permisos del grupo via gateway
            let permissions: Permission[] = [];
            if (profile?.group_id) {
                const permParams = new HttpParams()
                    .set('select', 'resource,can_view,can_create,can_edit,can_delete')
                    .set('group_id', `eq.${profile.group_id}`);
                const permRows = await firstValueFrom(
                    this.http.get<any[]>(`${this.gw}/api/rest/v1/permissions`, { params: permParams })
                );
                if (permRows && permRows.length > 0) {
                    permissions = this.mapPermissions(permRows);
                }
            }

            this.currentUser.set({
                id: authUser.id,
                email: authUser.email ?? '',
                username: authUser.user_metadata?.['username'] ?? authUser.email ?? '',
                fullName: profile?.full_name ?? authUser.user_metadata?.['full_name'] ?? '',
                puesto: profile?.puesto ?? undefined,
                groupId: profile?.group_id ?? undefined,
                permissions,
            });
        } catch (e) {
            console.warn('[AuthService] Error en hydrateUser via gateway:', e);
            // Fallback mínimo para no dejar current user en null
            this.currentUser.set({
                id: authUser.id,
                email: authUser.email ?? '',
                username: authUser.email ?? '',
                fullName: authUser.user_metadata?.['full_name'] ?? '',
                permissions: [],
            });
        }
    }

    // ── Convierte filas de `permissions` al tipo Permission[] ──────────────────
    private mapPermissions(rows: any[]): Permission[] {
        const result: Permission[] = [];

        for (const row of rows) {
            const r = row.resource as string;

            if (row.can_view) {
                result.push(`${r}:view` as Permission);
                if (r === 'user') result.push('users:view' as Permission);
            }
            if (row.can_create) {
                result.push(`${r}:create` as Permission);
                result.push(`${r}:add` as Permission);
                if (r === 'ticket') {
                    result.push('ticket:assign' as Permission);
                    result.push('ticket:comment' as Permission);
                    result.push('ticket:change_status' as Permission);
                    result.push('ticket:edit_state' as Permission);
                }
                if (r === 'group') {
                    result.push('group:add_member' as Permission);
                    result.push('group:remove_member' as Permission);
                }
                if (r === 'user') {
                    result.push('user:manage_permissions' as Permission);
                }
            }
            if (row.can_edit) {
                result.push(`${r}:edit` as Permission);
                if (r === 'ticket') {
                    result.push('ticket:edit_state' as Permission);
                    result.push('ticket:change_status' as Permission);
                    result.push('ticket:comment' as Permission);
                }
            }
            if (row.can_delete) {
                result.push(`${r}:delete` as Permission);
            }
        }

        return [...new Set(result)];
    }
}