import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiGatewayService } from './api-gateway.service';
import { AuthService } from './auth.service';
import { PermissionService } from './permission.service';
import { environment } from '../../enviroments/enviroment';
import type { ApiResponse } from '../models/api-response.model';

// ── Interfaces ────────────────────────────────────────────────────────────────

export type PriorityLevel =
  | 'Urgente' | 'Alta' | 'Media Alta' | 'Media' | 'Media Baja' | 'Baja' | 'Muy Baja';

export type TicketState =
  | 'Pendiente' | 'En progreso' | 'Revisión' | 'Hecho' | 'Bloqueado';

/** Columnas reales de la tabla `tickets` en Supabase */
export interface TicketDB {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  group_id: string;
  status: TicketState;
  priority: PriorityLevel;
  assignee: string | null;
  created_at?: string;
  due_date?: string | null;
}

/** Interfaz app-friendly camelCase para componentes */
export interface TicketItem {
  id: string;
  groupId: string;
  title: string;
  state: TicketState;
  createdBy: string;
  assignee: string;
  priority: PriorityLevel;
  createdAt?: string;
  description?: string;
  dueDate?: string;
}

// ── Mapper DB → App ───────────────────────────────────────────────────────────
function dbToApp(row: TicketDB): TicketItem {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    state: row.status,
    createdBy: row.created_by,
    assignee: row.assignee ?? '',
    priority: row.priority,
    createdAt: row.created_at ?? '',
    description: row.description ?? '',
    dueDate: row.due_date ?? undefined,
  };
}

/** Helper opCode */
function opCode(status: number): string {
  return `SxTI${status}`;
}

function respond<T>(statusCode: number, data: T): ApiResponse<T> {
  return { statusCode, intOpCode: opCode(statusCode), data };
}

/**
 * TicketService — Todas las respuestas siguen { statusCode, intOpCode, data }.
 * Valida token + permisos antes de cada operación.
 */
@Injectable({ providedIn: 'root' })
export class TicketService {
  private gateway = inject(ApiGatewayService);
  private auth = inject(AuthService);
  private permissions = inject(PermissionService);
  private http = inject(HttpClient);

  /** Base URL del API Gateway */
  private gw = environment.apiGatewayUrl;

  // ── Obtener tickets de un grupo ────────────────────────────────────────────

  async getTicketsByGroup(groupId: string): Promise<ApiResponse<TicketItem[] | null>> {
    const user = this.auth.currentUser();
    if (!user) return respond(401, null);

    if (!this.permissions.hasPermission('ticket:view')) {
      return respond(403, null);
    }

    try {
      const params = new HttpParams()
        .set('select', 'id,title,description,created_by,created_at,group_id,status,priority,assignee,due_date')
        .set('group_id', `eq.${groupId}`)
        .set('order', 'id.desc');

      const data = await firstValueFrom(
        this.http.get<TicketDB[]>(`${this.gw}/api/rest/v1/tickets`, { params })
      );

      return respond(200, (data ?? []).map(dbToApp));
    } catch {
      return respond(500, null);
    }
  }

  // ── Crear ticket ───────────────────────────────────────────────────────────

  async createTicket(ticket: Partial<TicketItem>): Promise<ApiResponse<TicketItem | null>> {
    const user = this.auth.currentUser();
    if (!user) return respond(401, null);

    const payload: Partial<TicketDB> = {
      title: ticket.title,
      description: ticket.description ?? '',
      created_by: user.id,
      group_id: ticket.groupId ?? user.groupId,
      status: ticket.state ?? 'Pendiente',
      priority: ticket.priority ?? 'Media',
      assignee: ticket.assignee ?? null,
      due_date: ticket.dueDate ?? null
    };

    const res = await this.gateway.insert<TicketDB>('tickets', 'ticket:create', payload);
    if (res.statusCode !== 201) return respond(res.statusCode, null);

    return respond(201, dbToApp(res.data as TicketDB));
  }

  // ── Actualizar ticket (edición general) ────────────────────────────────────

  async updateTicket(
    ticketId: string,
    changes: Partial<TicketItem>
  ): Promise<ApiResponse<TicketItem | null>> {
    const payload: Partial<TicketDB> = {};
    if (changes.title !== undefined) payload.title = changes.title;
    if (changes.description !== undefined) payload.description = changes.description;
    if (changes.state !== undefined) payload.status = changes.state;
    if (changes.priority !== undefined) payload.priority = changes.priority;
    if (changes.assignee !== undefined) payload.assignee = changes.assignee;
    if (changes.dueDate !== undefined) payload.due_date = changes.dueDate;

    const res = await this.gateway.update<TicketDB>('tickets', 'ticket:edit', ticketId, payload);
    if (res.statusCode !== 200) return respond(res.statusCode, null);

    return respond(200, dbToApp(res.data as TicketDB));
  }

  // ── Mover ticket (drag-and-drop Kanban) ────────────────────────────────────
  /**
   * editState / moveTicket — Reglas de negocio del pizarrón:
   *   1. El usuario DEBE tener permiso "ticket:change_status".
   *   2. El ticket DEBE estar asignado al usuario que hace el movimiento.
   * Si no cumple ambas → 403.
   */
  async moveTicket(
    ticketId: string,
    newState: TicketState,
    ticketAssigneeId: string
  ): Promise<ApiResponse<TicketItem | null>> {
    const user = this.auth.currentUser();
    if (!user) return respond(401, null);

    const canEdit   = this.permissions.hasPermission('ticket:edit');
    const canChange = this.permissions.hasPermission('ticket:change_status');

    // Regla 1: necesita al menos uno de los dos permisos
    if (!canEdit && !canChange) {
      return respond(403, null);
    }

    // Regla 2: ownership — solo aplica si NO tiene ticket:edit completo
    if (!canEdit && ticketAssigneeId !== user.id) {
      return { statusCode: 403, intOpCode: 'SxTI403_OWNER', data: null };
    }

    const res = await this.gateway.update<TicketDB>('tickets', 'ticket:change_status', ticketId, { status: newState });
    if (res.statusCode !== 200) return respond(res.statusCode, null);

    return respond(200, dbToApp(res.data as TicketDB));
  }

  // ── Eliminar ticket ────────────────────────────────────────────────────────

  async deleteTicket(ticketId: string): Promise<ApiResponse<null>> {
    return this.gateway.delete('tickets', 'ticket:delete', ticketId);
  }
}
