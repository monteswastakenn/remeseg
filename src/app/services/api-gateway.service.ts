import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService, Permission } from './auth.service';
import { PermissionService } from './permission.service';
import type { ApiResponse } from '../models/api-response.model';

/**
 * Capa lógica de "API Gateway" en el frontend.
 *
 * Antes de ejecutar cualquier operación contra Supabase, valida:
 *   1. Que exista sesión activa (token).
 *   2. Que el usuario posea el permiso requerido para la acción.
 *
 * Todas las respuestas se envuelven en el formato estándar ApiResponse.
 */
@Injectable({ providedIn: 'root' })
export class ApiGatewayService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private permissions = inject(PermissionService);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers internos
  // ─────────────────────────────────────────────────────────────────────────────

  /** Genera intOpCode: prefijo + recurso abreviado + statusCode */
  private opCode(prefix: string, resource: string, status: number): string {
    const tag = resource.substring(0, 2).toUpperCase();
    return `${prefix}${tag}${status}`;
  }

  /** Respuesta estándar rápida */
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD genérico
  // ─────────────────────────────────────────────────────────────────────────────

  /** SELECT con validación de viewer permission */
  async query<T = any>(
    table: string,
    permission: string,
    selectColumns = '*',
    filters?: Record<string, any>
  ): Promise<ApiResponse<T[] | null>> {
    const resource = table;
    const blocked = this.preCheck(permission, resource);
    if (blocked) return blocked as ApiResponse<null>;

    let query = this.sb.client.from(table).select(selectColumns);

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      return this.respond(500, this.opCode('Sx', resource, 500), null);
    }

    return this.respond(200, this.opCode('Sx', resource, 200), data as T[]);
  }

  /** INSERT con validación de creator permission */
  async insert<T = any>(
    table: string,
    permission: string,
    payload: Record<string, any>
  ): Promise<ApiResponse<T | null>> {
    const resource = table;
    const blocked = this.preCheck(permission, resource);
    if (blocked) return blocked as ApiResponse<null>;

    const { data, error } = await this.sb.client
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) {
      return this.respond(500, this.opCode('Sx', resource, 500), null);
    }

    return this.respond(201, this.opCode('Sx', resource, 201), data as T);
  }

  /** UPDATE con validación de editor permission */
  async update<T = any>(
    table: string,
    permission: string,
    id: string,
    payload: Record<string, any>
  ): Promise<ApiResponse<T | null>> {
    const resource = table;
    const blocked = this.preCheck(permission, resource);
    if (blocked) return blocked as ApiResponse<null>;

    const { data, error } = await this.sb.client
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return this.respond(500, this.opCode('Sx', resource, 500), null);
    }

    return this.respond(200, this.opCode('Sx', resource, 200), data as T);
  }

  /** DELETE con validación de delete permission */
  async delete(
    table: string,
    permission: string,
    id: string
  ): Promise<ApiResponse<null>> {
    const resource = table;
    const blocked = this.preCheck(permission, resource);
    if (blocked) return blocked as ApiResponse<null>;

    const { error } = await this.sb.client
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      return this.respond(500, this.opCode('Sx', resource, 500), null);
    }

    return this.respond(200, this.opCode('Sx', resource, 200), null);
  }
}
