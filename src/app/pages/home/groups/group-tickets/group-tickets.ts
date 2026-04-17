import { Component, inject, OnInit, signal, computed, LOCALE_ID } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DragDropModule } from 'primeng/dragdrop';

import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TableModule } from 'primeng/table';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { AuthService, DbUser } from '../../../../services/auth.service';
import { PermissionService } from '../../../../services/permission.service';
import { TicketService, TicketItem, TicketState, PriorityLevel } from '../../../../services/ticket.service';
import { HasPermissionDirective } from '../../../../directives/has-permission/has-permission.directive';

interface GroupItem { id: string; nombre: string; }

@Component({
  selector: 'app-group-tickets',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, DragDropModule, DatePipe,
    SelectModule, ButtonModule, CardModule, TagModule, AvatarModule,
    DialogModule, InputTextModule, TextareaModule, TableModule,
    SelectButtonModule, ToastModule, SkeletonModule, HasPermissionDirective,
  ],
  providers: [MessageService],
  templateUrl: './group-tickets.html',
  styleUrls: ['./group-tickets.css'],
})
export class GroupTickets implements OnInit {
  private auth = inject(AuthService);
  private permSvc = inject(PermissionService);
  private ticketSvc = inject(TicketService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private msgService = inject(MessageService);

  currentUser = this.auth.currentUser;

  // ── Estado de carga ──────────────────────────────────────────────────────────
  loading = signal(true);

  // ── Grupo cargado desde la ruta ──────────────────────────────────────────────
  selectedGroup = signal<GroupItem | null>(null);

  // ── Tickets de Supabase ──────────────────────────────────────────────────────
  allTickets = signal<TicketItem[]>([]);

  // ── Columnas Kanban derivadas ────────────────────────────────────────────────
  pendiente = signal<TicketItem[]>([]);
  enProgreso = signal<TicketItem[]>([]);
  revision = signal<TicketItem[]>([]);
  hecho = signal<TicketItem[]>([]);
  bloqueado = signal<TicketItem[]>([]);

  // ── Miembros del grupo (para dropdown "Asignado a") ─────────────────────
  groupMembers = signal<DbUser[]>([]);
  memberOptions = computed(() => [
    { label: '— Sin asignar —', value: '' },
    ...this.groupMembers().map(u => ({ label: `${u.full_name} (${u.email})`, value: u.id }))
  ]);


  activeFilter: 'Mis tickets' | 'Sin asignar' | 'Prioridad Alta' | null = null;

  get totalTickets(): number {
    return this.pendiente().length + this.enProgreso().length +
      this.revision().length + this.hecho().length + this.bloqueado().length;
  }

  get filteredGroupTickets(): TicketItem[] {
    let list = [...this.allTickets()];
    const userId = this.currentUser()?.id ?? '';
    if (this.activeFilter === 'Mis tickets') list = list.filter(t => t.assignee === userId);
    if (this.activeFilter === 'Sin asignar') list = list.filter(t => !t.assignee);
    if (this.activeFilter === 'Prioridad Alta') list = list.filter(t => t.priority === 'Urgente' || t.priority === 'Alta');
    return list;
  }

  stateOptions = ['Pendiente', 'En progreso', 'Revisión', 'Hecho', 'Bloqueado'].map(v => ({ label: v, value: v }));
  priorityOptions = ['Urgente', 'Alta', 'Media Alta', 'Media', 'Media Baja', 'Baja', 'Muy Baja'].map(v => ({ label: v, value: v }));
  viewModeOptions = [
    { label: 'Tablero', value: 'kanban', icon: 'pi pi-objects-column' },
    { label: 'Lista', value: 'list', icon: 'pi pi-list' }
  ];
  viewMode: 'kanban' | 'list' = 'kanban';

  createDialogVisible = false;
  newTicket: Partial<TicketItem> = {};
  creating = signal(false); // Guard anti-doble-clic

  editDialogVisible = false;
  selectedTicket: TicketItem | null = null;
  editingTicket: Partial<TicketItem> = {};
  newCommentText = '';

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  async ngOnInit() {
    const groupId = this.route.snapshot.paramMap.get('groupId');
    if (groupId) {
      // Cargamos los grupos reales para obtener el nombre.
      const groupsRes = await this.auth.getGroups();
      const groups = groupsRes.data ?? [];
      const found = groups.find(g => g.id === groupId);
      if (found) {
        this.selectedGroup.set({ id: found.id, nombre: found.name });
      } else {
        this.selectedGroup.set({ id: groupId, nombre: groupId });
      }
      await this.loadTickets(groupId);
      await this.loadGroupMembers(groupId);
    }
    this.loading.set(false);
  }

  // ── Cargar miembros del grupo ────────────────────────────────────────────────
  private async loadGroupMembers(groupId: string) {
    const res = await this.auth.getUsers();
    const allUsers = res.data ?? [];
    this.groupMembers.set(allUsers.filter(u => u.group_id === groupId));
  }

  // ── Cargar tickets de Supabase ───────────────────────────────────────────────
  async loadTickets(groupId: string) {
    this.loading.set(true);
    const response = await this.ticketSvc.getTicketsByGroup(groupId);

    if (response.statusCode === 200 && response.data) {
      this.allTickets.set(response.data);
      this.distributeTickets(response.data);
    } else {
      this.allTickets.set([]);
      this.distributeTickets([]);
      if (response.statusCode === 403) {
        this.msgService.add({
          severity: 'warn', summary: 'Sin permisos',
          detail: 'No tienes acceso a los tickets de este grupo.', life: 4000
        });
      }
    }
    this.loading.set(false);
  }

  private distributeTickets(tickets: TicketItem[]) {
    const filtered = this.applyFilter(tickets);
    this.pendiente.set(filtered.filter(t => t.state === 'Pendiente'));
    this.enProgreso.set(filtered.filter(t => t.state === 'En progreso'));
    this.revision.set(filtered.filter(t => t.state === 'Revisión'));
    this.hecho.set(filtered.filter(t => t.state === 'Hecho'));
    this.bloqueado.set(filtered.filter(t => t.state === 'Bloqueado'));
  }

  private applyFilter(tickets: TicketItem[]): TicketItem[] {
    const userId = this.currentUser()?.id ?? '';
    if (this.activeFilter === 'Mis tickets') return tickets.filter(t => t.assignee === userId);
    if (this.activeFilter === 'Sin asignar') return tickets.filter(t => !t.assignee);
    if (this.activeFilter === 'Prioridad Alta') return tickets.filter(t => t.priority === 'Urgente' || t.priority === 'Alta');
    return tickets;
  }

  setFilter(filter: 'Mis tickets' | 'Sin asignar' | 'Prioridad Alta' | null) {
    this.activeFilter = filter;
    this.distributeTickets(this.allTickets());
  }

  // ── Drag & Drop – PrimeNG (p-dragdrop) ──────────────
  draggedTicket: TicketItem | null = null;

  dragStart(ticket: TicketItem) {
    this.draggedTicket = ticket;
  }

  dragEnd() {
    this.draggedTicket = null;
  }

  async drop(newState: TicketState) {
    if (!this.draggedTicket) return;
    const ticket = this.draggedTicket;

    if (ticket.state === newState) {
      this.draggedTicket = null;
      return;
    }

    const oldState = ticket.state;
    ticket.state = newState; // Optimistic visually

    // Persistir en Supabase — moveTicket valida permiso + ownership
    const result = await this.ticketSvc.moveTicket(ticket.id, newState, ticket.assignee);

    if (result.statusCode !== 200) {
      // Revertir si falla
      ticket.state = oldState;
      const detail = result.intOpCode === 'SxTI403_OWNER'
        ? 'Solo puedes mover tickets asignados a ti.'
        : result.statusCode === 403
          ? 'No tienes permiso para cambiar estado de tickets.'
          : 'Error de servidor al actualizar estado.';

      this.msgService.add({ severity: 'error', summary: 'Movimiento bloqueado', detail, life: 4000 });
    } else {
      this.distributeTickets(this.allTickets()); // Redistribuir visualmente
      this.msgService.add({
        severity: 'success', summary: 'Estado actualizado',
        detail: `"${ticket.title}" → ${newState}`, life: 2500
      });
    }

    this.draggedTicket = null;
  }

  // ── Abrir ticket ─────────────────────────────────────────────────────────────
  openTicket(ticket: TicketItem) {
    this.selectedTicket = ticket;
    this.editingTicket = { ...ticket };
    this.newCommentText = '';
    this.editDialogVisible = true;
  }

  // ── Guardar cambios del ticket (Supabase) ────────────────────────────────────
  async saveTicket() {
    if (!this.selectedTicket) return;

    const changes: Partial<TicketItem> = {};
    if (this.editingTicket.title !== this.selectedTicket.title) changes.title = this.editingTicket.title;
    if (this.editingTicket.description !== this.selectedTicket.description) changes.description = this.editingTicket.description;
    if (this.editingTicket.state !== this.selectedTicket.state) changes.state = this.editingTicket.state;
    if (this.editingTicket.priority !== this.selectedTicket.priority) changes.priority = this.editingTicket.priority;

    if (Object.keys(changes).length > 0) {
      const result = await this.ticketSvc.updateTicket(this.selectedTicket.id, changes);
      if (result.statusCode === 200) {
        Object.assign(this.selectedTicket, changes);
        this.distributeTickets(this.allTickets());
        this.msgService.add({ severity: 'success', summary: 'Guardado', detail: 'Ticket actualizado.', life: 2500 });
      } else {
        this.msgService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar.', life: 3000 });
      }
    }

    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  cancelEdit() {
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  // ── Eliminar ticket (Supabase) ───────────────────────────────────────────────
  async deleteTicket() {
    if (!this.selectedTicket) return;
    const result = await this.ticketSvc.deleteTicket(this.selectedTicket.id);
    if (result.statusCode === 200 || result.statusCode === 204) {
      this.allTickets.update(list => list.filter(t => t.id !== this.selectedTicket!.id));
      this.distributeTickets(this.allTickets());
      this.msgService.add({ severity: 'success', summary: 'Ticket eliminado', life: 2500 });
    }
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  // ── Crear ticket (Supabase) ──────────────────────────────────────────────────
  createTicket() {
    const g = this.selectedGroup();
    if (!g) return;
    this.newTicket = {
      title: '', description: '', state: 'Pendiente',
      priority: 'Media', groupId: g.id,
    };
    this.createDialogVisible = true;
  }

  async confirmCreateTicket() {
    // Guard: evita duplicados por doble clic
    if (this.creating()) return;
    if (!this.newTicket.title?.trim() || !this.selectedGroup()) return;

    this.creating.set(true);
    this.newTicket.groupId = this.selectedGroup()!.id;

    try {
      const result = await this.ticketSvc.createTicket(this.newTicket);
      if (result.statusCode === 201 && result.data) {
        this.allTickets.update(list => [result.data!, ...list]);
        this.distributeTickets(this.allTickets());
        this.createDialogVisible = false;
        this.msgService.add({
          severity: 'success', summary: 'Ticket creado',
          detail: `"${result.data.title}"`, life: 2500
        });
        this.openTicket(result.data);
      } else {
        this.msgService.add({ severity: 'error', summary: 'Error al crear', detail: 'Verifica los datos.', life: 3000 });
      }
    } finally {
      this.creating.set(false);
    }
  }

  addComment() {
    // Comentarios locales por ahora (sin tabla separada en Supabase)
    if (!this.newCommentText.trim() || !this.editingTicket) return;
    this.newCommentText = '';
  }

  // ── Helpers permisos ─────────────────────────────────────────────────────────
  hasPermission(perm: string): boolean { return this.permSvc.hasPermission(perm); }

  get canEditFull(): boolean { return this.hasPermission('ticket:edit'); }
  get canEditStatusOnly(): boolean { return this.hasPermission('ticket:edit_state') || this.hasPermission('ticket:change_status'); }
  get canDeleteTicket(): boolean { return this.hasPermission('ticket:delete'); }
  get canCreateTicket(): boolean { return this.hasPermission('ticket:add') || this.hasPermission('ticket:create'); }
  get canAssignTicket(): boolean { return this.hasPermission('ticket:assign'); }

  // ── Helpers UI ───────────────────────────────────────────────────────────────
  getPrioritySeverity(priority: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    if (priority === 'Urgente' || priority === 'Alta') return 'danger';
    if (priority === 'Media Alta' || priority === 'Media') return 'warn';
    if (priority === 'Media Baja') return 'info';
    if (priority === 'Baja' || priority === 'Muy Baja') return 'success';
    return 'info';
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /** Inicial del asignado para el avatar. Resuelve UUID → nombre. */
  assigneeLabel(assignee: string): string {
    if (!assignee) return '?';
    const member = this.groupMembers().find(u => u.id === assignee);
    if (member) return member.full_name.charAt(0).toUpperCase();
    return assignee.includes('@') ? assignee.charAt(0).toUpperCase() : '?';
  }

  /** Nombre completo del asignado. UUID → full_name */
  assigneeName(assignee: string): string {
    if (!assignee) return 'Sin asignar';
    const member = this.groupMembers().find(u => u.id === assignee);
    return member?.full_name ?? assignee;
  }
}
