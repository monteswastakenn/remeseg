import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, Permission } from './auth.service';
import { PermissionService } from './permission.service';
import { environment } from '../../enviroments/enviroment';
import type { ApiResponse } from '../models/api-response.model';

/**
 * ApiGatewayService — Capa de acceso a datos mediante HTTP.
 *
 * TODAS las peticiones a tablas de Supabase pasan por el API Gateway
 * desplegado en Railway (Fastify). El front NUNCA habla directamente
 * con Supabase para acceso a datos.
 *
 * Flujo:
 *   Angular (HttpClient) ──► Railway Gateway ──► Supabase REST API
 *
 * El interceptor `auth.interceptor.ts` inyecta automáticamente el
 * Bearer token en cada petición que salga hacia `apiGatewayUrl`.
 */
@Injectable({ providedIn: 'root' })
export class ApiGatewayService {
    private http        = inject(HttpClient);
    private auth        = inject(AuthService);
    private permissions = inject(PermissionService);

    /** Base URL del gateway de Railway (http://localhost:3000 en dev) */
    private base = environment.apiGatewayUrl;

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers internos
    // ─────────────────────────────────────────────────────────────────────────

    /** Genera intOpCode: prefijo + recurso abreviado + statusCode */
    private opCode(prefix: string, resource: string, status: number): string {
        const tag = resource.substring(0, 2).toUpperCase();
        return `${prefix}${tag}${status}`;
    }

    /** Respuesta estándar */
    private respond<T>(statusCode: number, intOpCode: string, data: T): ApiResponse<T> {
        return { statusCode, intOpCode, data };
    }

    /** Comprobación previa de autenticación + permiso */
    private preCheck(requiredPermission: string, resource: string): ApiResponse | null {
        if (!this.auth.isLoggedIn()) {
            return this.respond(401, this.opCode('Sx', resource, 401), null);
        }
        if (!this.permissions.hasPermission(requiredPermission)) {
            return this.respond(403, this.opCode('Sx', resource, 403), null);
        }
        return null; // todo ok
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD genérico — todas las peticiones van al gateway
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * SELECT — GET /api/rest/v1/<table>?select=*&<filtros>
     *
     * El gateway reenvía a Supabase PostgREST con la API key inyectada.
     */
    async query<T = any>(
        table: string,
        permission: string,
        selectColumns = '*',
        filters?: Record<string, any>
    ): Promise<ApiResponse<T[] | null>> {
        const resource = table;
        const blocked = this.preCheck(permission, resource);
        if (blocked) return blocked as ApiResponse<null>;

        const t0 = performance.now();

        try {
            // Construir query params de PostgREST
            let params = new HttpParams().set('select', selectColumns);
            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    params = params.set(`${key}`, `eq.${value}`);
                }
            }

            const url = `${this.base}/api/rest/v1/${table}`;
            const data = await firstValueFrom(
                this.http.get<T[]>(url, { params })
            );

            const responseMs = Math.round(performance.now() - t0);
            console.debug(`[Gateway] GET ${table} → ${responseMs}ms`);

            return this.respond(200, this.opCode('Sx', resource, 200), data);
        } catch (err: any) {
            console.error(`[Gateway] Error en query(${table}):`, err);
            return this.respond(500, this.opCode('Sx', resource, 500), null);
        }
    }

    /**
     * INSERT — POST /api/rest/v1/<table>
     *
     * Cabecera `Prefer: return=representation` para obtener la fila creada.
     */
    async insert<T = any>(
        table: string,
        permission: string,
        payload: Record<string, any>
    ): Promise<ApiResponse<T | null>> {
        const resource = table;
        const blocked = this.preCheck(permission, resource);
        if (blocked) return blocked as ApiResponse<null>;

        const t0 = performance.now();

        try {
            const url = `${this.base}/api/rest/v1/${table}`;
            const rows = await firstValueFrom(
                this.http.post<T[]>(url, payload, {
                    headers: { 'Prefer': 'return=representation' },
                })
            );

            const responseMs = Math.round(performance.now() - t0);
            console.debug(`[Gateway] POST ${table} → ${responseMs}ms`);

            // PostgREST devuelve array; tomamos el primer elemento
            const data = Array.isArray(rows) ? rows[0] : rows;
            return this.respond(201, this.opCode('Sx', resource, 201), data as T);
        } catch (err: any) {
            console.error(`[Gateway] Error en insert(${table}):`, err);
            return this.respond(500, this.opCode('Sx', resource, 500), null);
        }
    }

    /**
     * UPDATE — PATCH /api/rest/v1/<table>?id=eq.<id>
     *
     * Cabecera `Prefer: return=representation` para obtener la fila actualizada.
     */
    async update<T = any>(
        table: string,
        permission: string,
        id: string,
        payload: Record<string, any>
    ): Promise<ApiResponse<T | null>> {
        const resource = table;
        const blocked = this.preCheck(permission, resource);
        if (blocked) return blocked as ApiResponse<null>;

        const t0 = performance.now();

        try {
            const params = new HttpParams().set('id', `eq.${id}`);
            const url = `${this.base}/api/rest/v1/${table}`;
            const rows = await firstValueFrom(
                this.http.patch<T[]>(url, payload, {
                    params,
                    headers: { 'Prefer': 'return=representation' },
                })
            );

            const responseMs = Math.round(performance.now() - t0);
            console.debug(`[Gateway] PATCH ${table}/${id} → ${responseMs}ms`);

            const data = Array.isArray(rows) ? rows[0] : rows;
            return this.respond(200, this.opCode('Sx', resource, 200), data as T);
        } catch (err: any) {
            console.error(`[Gateway] Error en update(${table}, ${id}):`, err);
            return this.respond(500, this.opCode('Sx', resource, 500), null);
        }
    }

    /**
     * DELETE — DELETE /api/rest/v1/<table>?id=eq.<id>
     */
    async delete(
        table: string,
        permission: string,
        id: string
    ): Promise<ApiResponse<null>> {
        const resource = table;
        const blocked = this.preCheck(permission, resource);
        if (blocked) return blocked as ApiResponse<null>;

        const t0 = performance.now();

        try {
            const params = new HttpParams().set('id', `eq.${id}`);
            const url = `${this.base}/api/rest/v1/${table}`;
            await firstValueFrom(
                this.http.delete(url, { params })
            );

            const responseMs = Math.round(performance.now() - t0);
            console.debug(`[Gateway] DELETE ${table}/${id} → ${responseMs}ms`);

            return this.respond(200, this.opCode('Sx', resource, 200), null);
        } catch (err: any) {
            console.error(`[Gateway] Error en delete(${table}, ${id}):`, err);
            return this.respond(500, this.opCode('Sx', resource, 500), null);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers especiales para upsert y consultas con filtros múltiples
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * UPSERT — POST /api/rest/v1/<table> con Prefer: resolution=merge-duplicates
     */
    async upsert<T = any>(
        table: string,
        permission: string,
        payload: Record<string, any>,
        onConflict?: string
    ): Promise<ApiResponse<T | null>> {
        const resource = table;
        const blocked = this.preCheck(permission, resource);
        if (blocked) return blocked as ApiResponse<null>;

        const t0 = performance.now();

        try {
            let preferHeader = 'return=representation,resolution=merge-duplicates';
            let url = `${this.base}/api/rest/v1/${table}`;
            if (onConflict) url += `?on_conflict=${onConflict}`;

            const rows = await firstValueFrom(
                this.http.post<T[]>(url, payload, {
                    headers: { 'Prefer': preferHeader },
                })
            );

            const responseMs = Math.round(performance.now() - t0);
            console.debug(`[Gateway] UPSERT ${table} → ${responseMs}ms`);

            const data = Array.isArray(rows) ? rows[0] : rows;
            return this.respond(200, this.opCode('Sx', resource, 200), data as T);
        } catch (err: any) {
            console.error(`[Gateway] Error en upsert(${table}):`, err);
            return this.respond(500, this.opCode('Sx', resource, 500), null);
        }
    }

    /**
     * Health Check — GET /health
     */
    async health(): Promise<ApiResponse<string>> {
        try {
            const result = await firstValueFrom(
                this.http.get<{ status: string }>(`${this.base}/health`)
            );
            const ok = result.status === 'ok';
            return this.respond(
                ok ? 200 : 503,
                this.opCode('Sx', 'he', ok ? 200 : 503),
                ok ? 'OK' : 'Service Unavailable'
            );
        } catch {
            return this.respond(503, this.opCode('Sx', 'he', 503), 'Service Unavailable');
        }
    }
}
