import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToolbarModule } from 'primeng/toolbar';
import { PanelModule } from 'primeng/panel';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';

import { MessageService } from 'primeng/api';

type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;
type Status = 'Activo' | 'Pausado' | 'Inactivo';

import { AuthService, AppUser } from '../../../services/auth.service';
import { PermissionService } from '../../../services/permission.service';
import { TicketService, TicketItem } from '../../../services/ticket.service';
import { HasPermissionDirective } from '../../../directives/has-permission/has-permission.directive';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CardModule, AvatarModule, DividerModule, ButtonModule, InputTextModule,
    TableModule, TagModule, ToolbarModule, PanelModule, ToastModule, DialogModule,
    SkeletonModule, HasPermissionDirective,
  ],
  providers: [MessageService],
  templateUrl: './users.html',
  styleUrls: ['./users.css']
})
export class Users implements OnInit {
  private auth      = inject(AuthService);
  private msg       = inject(MessageService);
  private permSvc   = inject(PermissionService);
  private ticketSvc = inject(TicketService);

  // ── Estado reactivo ─────────────────────────────────────────────────────────
  loading = signal(true);
  currentUser = signal<AppUser | null>(null);

  q = '';

  // Tickets asignados cargados de Supabase
  assignedTickets = signal<TicketItem[]>([]);

  // ── Diálogo de edición ──────────────────────────────────────────────────────
  editDialogVisible = false;
  editingUser: { fullName: string; puesto: string } = { fullName: '', puesto: '' };

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async ngOnInit() {
    // Esperar hidratación del usuario
    let retries = 0;
    while (!this.auth.currentUser()?.id && retries < 20) {
      await new Promise(r => setTimeout(r, 150));
      retries++;
    }

    const user = this.auth.currentUser();
    this.currentUser.set(user);

    if (user?.groupId) {
      await this.loadMyTickets(user);
    }

    this.loading.set(false);
  }

  // ── Cargar tickets asignados al usuario ────────────────────────────────────
  private async loadMyTickets(user: AppUser) {
    if (!user.groupId) return;

    const res = await this.ticketSvc.getTicketsByGroup(user.groupId);
    if (res.statusCode === 200 && res.data) {
      const mine = res.data.filter(t => t.assignee === user.id);
      this.assignedTickets.set(mine);
    }
  }

  // ── Permisos del usuario como tabla ────────────────────────────────────────
  get permissions() {
    const user = this.currentUser();
    if (!user?.permissions) return [];
    return user.permissions.map(p => {
      let module = 'General';
      if (p.startsWith('group')) module = 'Groups';
      if (p.startsWith('ticket')) module = 'Ticket';
      if (p.startsWith('user')) module = 'Users';
      return { module, name: p, status: 'Activo' as Status };
    });
  }

  filteredPermissions = computed(() => {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.permissions;
    return this.permissions.filter(p =>
      p.name.toLowerCase().includes(s) || p.module?.toLowerCase().includes(s)
    );
  });

  // ── Editar perfil ─────────────────────────────────────────────────────────
  openEdit() {
    const user = this.currentUser();
    this.editingUser = {
      fullName: user?.fullName ?? '',
      puesto: user?.puesto ?? '',
    };
    this.editDialogVisible = true;
  }

  async saveEdit() {
    const user = this.currentUser();
    if (!user) return;

    const res = await this.auth.updateUser(user.id, {
      full_name: this.editingUser.fullName.trim(),
      puesto: this.editingUser.puesto.trim() || null,
    });

    if (res.statusCode === 200) {
      // Actualizar signal local
      this.currentUser.set({
        ...user,
        fullName: this.editingUser.fullName,
        puesto: this.editingUser.puesto || undefined,
      });
      this.editDialogVisible = false;
      this.msg.add({ severity: 'success', summary: 'Actualizado', detail: 'Perfil guardado correctamente.', life: 2500 });
    } else {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el perfil.', life: 3000 });
    }
  }

  // ── Stats derivadas ───────────────────────────────────────────────────────
  get totalTickets()    { return this.assignedTickets().length; }
  get pendingTickets()  { return this.assignedTickets().filter(t => t.state === 'Pendiente').length; }
  get progressTickets() { return this.assignedTickets().filter(t => t.state === 'En progreso').length; }
  get doneTickets()     { return this.assignedTickets().filter(t => t.state === 'Hecho').length; }
  get blockedTickets()  { return this.assignedTickets().filter(t => t.state === 'Bloqueado').length; }

  // ── Helpers UI ────────────────────────────────────────────────────────────
  statusSeverity(status: Status): TagSeverity {
    if (status === 'Activo') return 'success';
    if (status === 'Pausado') return 'warn';
    return 'danger';
  }

  getPrioritySeverity(priority: string): TagSeverity {
    if (priority.includes('Urgente')) return 'danger';
    if (priority.includes('Alta')) return 'warn';
    if (priority.includes('Baja')) return 'info';
    return 'success';
  }

  hasPermission(perm: string): boolean {
    return this.permSvc.hasPermission(perm);
  }
}