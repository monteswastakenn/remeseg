import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
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

    private sb = inject(SupabaseService);
    private supabase = this.sb.client;

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
    async login(email: string, password: string): Promise<ApiResponse<AppUser | null>> {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session) {
            return respond(401, 'users', null);
        }

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
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, username },
            },
        });

        if (error) return respond(400, 'users', null);

        // Insertar fila en la tabla `users` (esquema real: id, email, full_name, password_hash)
        if (data.user) {
            const { error: insertError } = await this.supabase.from('users').insert({
                id: data.user.id,
                email,
                full_name: fullName,
                password_hash: password // Pasamos el password para cumplir con tu tabla
            });

            if (insertError) {
                console.warn('Error insertando perfil en users:', insertError.message);
            }
        }

        return respond(201, 'users', { userId: data.user?.id ?? '' });
    }

    // ── Logout ──────────────────────────────────────────────────────────────────
    async logout(): Promise<void> {
        await this.supabase.auth.signOut();
        this.currentUser.set(null);
    }

    isLoggedIn(): boolean {
        return this.currentUser() !== null;
    }

    // ── Obtener todos los usuarios ──────────────────────────────────────────────
    async getUsers(): Promise<ApiResponse<DbUser[] | null>> {
        const { data, error } = await this.supabase
            .from('users')
            .select('id, full_name, email, group_id, puesto')
            .order('full_name');

        if (error) return respond(500, 'users', null);
        return respond(200, 'users', data ?? []);
    }

    // ── Obtener todos los grupos ────────────────────────────────────────────────
    async getGroups(): Promise<ApiResponse<DbGroup[] | null>> {
        const { data, error } = await this.supabase
            .from('groups')
            .select('id, name, description')
            .order('name');

        if (error) return respond(500, 'groups', null);
        return respond(200, 'groups', data ?? []);
    }

    // ── Actualizar group_id de un usuario ──────────────────────────────────────
    async updateUserGroup(userId: string, groupId: string | null): Promise<ApiResponse<null>> {
        const { error } = await this.supabase
            .from('users')
            .update({ group_id: groupId })
            .eq('id', userId);

        if (error) return respond(500, 'users', null);
        return respond(200, 'users', null);
    }

    // ── Actualizar datos completos de un usuario ────────────────────────────────
    async updateUser(
        userId: string,
        payload: Partial<Pick<DbUser, 'full_name' | 'group_id' | 'puesto'>>
    ): Promise<ApiResponse<DbUser | null>> {
        const { data, error } = await this.supabase
            .from('users')
            .update(payload)
            .eq('id', userId)
            .select()
            .single();

        if (error) return respond(500, 'users', null);
        return respond(200, 'users', data as DbUser);
    }

    // ── Obtener permisos de un grupo ─────────────────────────────────────────────
    async getGroupPermissions(groupId: string): Promise<ApiResponse<DbPermission[] | null>> {
        const { data, error } = await this.supabase
            .from('permissions')
            .select('id, group_id, resource, can_view, can_create, can_edit, can_delete')
            .eq('group_id', groupId);

        if (error) return respond(500, 'permissions', null);
        return respond(200, 'permissions', data ?? []);
    }

    // ── Actualizar una fila de permiso (toggle individual) ───────────────────
    async updatePermission(
        permissionId: string,
        changes: Partial<Pick<DbPermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>>
    ): Promise<ApiResponse<null>> {
        const { error } = await this.supabase
            .from('permissions')
            .update(changes)
            .eq('id', permissionId);

        if (error) return respond(500, 'permissions', null);
        return respond(200, 'permissions', null);
    }

    // ── Crear o actualizar fila de permiso para un grupo + recurso ───────────
    async upsertPermission(
        groupId: string,
        resource: string,
        perms: { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }
    ): Promise<ApiResponse<DbPermission | null>> {
        const { data, error } = await this.supabase
            .from('permissions')
            .upsert(
                { group_id: groupId, resource, ...perms },
                { onConflict: 'group_id,resource' }
            )
            .select()
            .single();

        if (error) return respond(500, 'permissions', null);
        return respond(200, 'permissions', data as DbPermission);
    }

    // ── Eliminar usuario de la tabla users ───────────────────────────────────
    async deleteUser(userId: string): Promise<ApiResponse<null>> {
        const { error } = await this.supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) return respond(500, 'users', null);
        return respond(200, 'users', null);
    }

    // ── Carga el perfil completo desde la tabla `users` ─────────────────────────
    async hydrateUser(session: Session | any): Promise<void> {
        const authUser: User = session.user;

        // Leer el perfil desde la tabla pública `users`
        const { data: profile } = await this.supabase
            .from('users')
            .select('id, full_name, email, group_id, puesto')
            .eq('id', authUser.id)
            .single();

        // Leer permisos desde la tabla `permissions` usando group_id
        let permissions: Permission[] = [];
        if (profile?.group_id) {
            const { data: permRows } = await this.supabase
                .from('permissions')
                .select('resource, can_view, can_create, can_edit, can_delete')
                .eq('group_id', profile.group_id);

            if (permRows && permRows.length > 0) {
                permissions = this.mapPermissions(permRows);
            }
        }

        // ⛔ SIN FALLBACK — usuario sin grupo = sin permisos = array vacío

        this.currentUser.set({
            id: authUser.id,
            email: authUser.email ?? '',
            username: authUser.user_metadata?.['username'] ?? authUser.email ?? '',
            fullName: profile?.full_name ?? authUser.user_metadata?.['full_name'] ?? '',
            puesto: profile?.puesto ?? undefined,
            groupId: profile?.group_id ?? undefined,
            permissions,
        });
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