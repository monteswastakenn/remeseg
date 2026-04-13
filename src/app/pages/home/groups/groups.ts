import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToolbarModule } from 'primeng/toolbar';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';

import { AuthService, DbGroup } from '../../../services/auth.service';
import { ApiGatewayService } from '../../../services/api-gateway.service';
import { TicketService } from '../../../services/ticket.service';
import { HasPermissionDirective } from '../../../directives/has-permission/has-permission.directive';
import type { ApiResponse } from '../../../models/api-response.model';

/** Vista enriquecida de un grupo con conteo de tickets */
interface GroupRow {
  id: string;
  name: string;
  description: string;
  ticketCount: number;
  memberCount: number;
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    CardModule, TableModule, TagModule, ButtonModule, InputTextModule,
    ToolbarModule, DialogModule, TextareaModule, ToastModule, SkeletonModule,
    HasPermissionDirective,
  ],
  providers: [MessageService],
  templateUrl: './groups.html',
  styleUrls: ['./groups.css']
})
export class Groups implements OnInit {
  private msg       = inject(MessageService);
  private auth      = inject(AuthService);
  private gateway   = inject(ApiGatewayService);
  private ticketSvc = inject(TicketService);
  private router    = inject(Router);

  loading = signal(true);
  groups  = signal<GroupRow[]>([]);

  q = '';

  filtered = computed(() => {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.groups();
    return this.groups().filter(g => g.name.toLowerCase().includes(s));
  });

  // ── Dialog CRUD ───────────────────────────────────────────────────────────
  dialogOpen = false;
  isEdit = false;
  editingGroupId = '';
  draft = { name: '', description: '' };

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    await this.loadGroups();
  }

  async loadGroups() {
    this.loading.set(true);

    const groupsRes = await this.auth.getGroups();
    const rawGroups: DbGroup[] = groupsRes.data ?? [];

    // Cargar conteo de tickets y miembros por grupo
    const enriched = await Promise.all(
      rawGroups.map(async (g): Promise<GroupRow> => {
        const ticketRes = await this.ticketSvc.getTicketsByGroup(g.id);
        const ticketCount = ticketRes.data?.length ?? 0;

        // Contar miembros del grupo
        const usersRes = await this.auth.getUsers();
        const allUsers = usersRes.data ?? [];
        const memberCount = allUsers.filter(u => u.group_id === g.id).length;

        return {
          id: g.id,
          name: g.name,
          description: g.description ?? 'Sin descripción',
          ticketCount,
          memberCount,
        };
      })
    );

    this.groups.set(enriched);
    this.loading.set(false);
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  viewTickets(row: GroupRow) {
    this.router.navigate(['/home/groups', row.id]);
  }

  // ── Crear grupo ───────────────────────────────────────────────────────────
  openCreate() {
    this.isEdit = false;
    this.editingGroupId = '';
    this.draft = { name: '', description: '' };
    this.dialogOpen = true;
  }

  // ── Editar grupo ──────────────────────────────────────────────────────────
  openEdit(row: GroupRow) {
    this.isEdit = true;
    this.editingGroupId = row.id;
    this.draft = { name: row.name, description: row.description };
    this.dialogOpen = true;
  }

  // ── Guardar (crear o editar) ──────────────────────────────────────────────
  async save() {
    if (!this.draft.name.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El nombre es obligatorio.', life: 3000 });
      return;
    }

    let result: ApiResponse;

    if (this.isEdit) {
      result = await this.gateway.update('groups', 'group:edit', this.editingGroupId, {
        name: this.draft.name.trim(),
        description: this.draft.description.trim() || null,
      });
    } else {
      result = await this.gateway.insert('groups', 'group:create', {
        name: this.draft.name.trim(),
        description: this.draft.description.trim() || null,
      });
    }

    if (result.statusCode >= 200 && result.statusCode < 300) {
      this.msg.add({ severity: 'success', summary: this.isEdit ? 'Grupo actualizado' : 'Grupo creado', life: 2500 });
      this.dialogOpen = false;
      await this.loadGroups();
    } else if (result.statusCode === 403) {
      this.msg.add({ severity: 'error', summary: 'Sin permisos', detail: 'No tienes permiso para esta acción.', life: 4000 });
    } else {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el grupo.', life: 3000 });
    }
  }

  // ── Eliminar grupo ────────────────────────────────────────────────────────
  async remove(row: GroupRow) {
    const result = await this.gateway.delete('groups', 'group:delete', row.id);
    if (result.statusCode === 200) {
      this.groups.update(list => list.filter(g => g.id !== row.id));
      this.msg.add({ severity: 'success', summary: 'Grupo eliminado', life: 2500 });
    } else if (result.statusCode === 403) {
      this.msg.add({ severity: 'error', summary: 'Sin permisos', detail: 'No tienes permiso para eliminar grupos.', life: 4000 });
    } else {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el grupo.', life: 3000 });
    }
  }
}