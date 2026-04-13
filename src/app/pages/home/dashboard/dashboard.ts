import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../services/auth.service';
import { TicketService, TicketItem } from '../../../services/ticket.service';
import { HasPermissionDirective } from '../../../directives/has-permission/has-permission.directive';

interface RecentActivity {
  icon: string;
  title: string;
  detail: string;
  time: string;
  color: string;
}

interface GroupOption {
  label: string;
  value: string;  // UUID real de Supabase
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    ChartModule,
    SelectModule,
    ButtonModule,
    TagModule,
    AvatarModule,
    TableModule,
    TooltipModule,
    ToastModule,
    SkeletonModule,
    HasPermissionDirective,
  ],
  providers: [MessageService],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard implements OnInit {
  private auth       = inject(AuthService);
  private ticketSvc  = inject(TicketService);
  private router     = inject(Router);
  private msg        = inject(MessageService);

  currentUser = this.auth.currentUser;

  // ── Estado de carga ─────────────────────────────────────────────────────────
  loading = signal(true);

  // ── Grupos dinámicos (de Supabase) ─────────────────────────────────────────
  groupOptions = signal<GroupOption[]>([]);
  selectedGroupId = signal<string>('');

  // ── Tickets cargados de Supabase ────────────────────────────────────────────
  allTickets = signal<TicketItem[]>([]);

  // ── Métricas derivadas (Computed Signals) ───────────────────────────────────
  totalTickets    = computed(() => this.allTickets().length);
  ticketsPendiente  = computed(() => this.allTickets().filter(t => t.state === 'Pendiente').length);
  ticketsEnProgreso = computed(() => this.allTickets().filter(t => t.state === 'En progreso').length);
  ticketsRevision   = computed(() => this.allTickets().filter(t => t.state === 'Revisión').length);
  ticketsHecho      = computed(() => this.allTickets().filter(t => t.state === 'Hecho').length);
  ticketsBloqueado  = computed(() => this.allTickets().filter(t => t.state === 'Bloqueado').length);

  ticketsUrgente = computed(() => this.allTickets().filter(t => t.priority === 'Urgente').length);
  ticketsAlta    = computed(() => this.allTickets().filter(t => t.priority === 'Alta' || t.priority === 'Media Alta').length);
  ticketsMedia   = computed(() => this.allTickets().filter(t => t.priority === 'Media' || t.priority === 'Media Baja').length);
  ticketsBaja    = computed(() => this.allTickets().filter(t => t.priority === 'Baja' || t.priority === 'Muy Baja').length);

  completionRate = computed(() => {
    const total = this.totalTickets();
    if (total === 0) return 0;
    return Math.round((this.ticketsHecho() / total) * 100);
  });

  myTickets = computed(() => {
    const userId = this.currentUser()?.id ?? '';
    return this.allTickets().filter(t => t.assignee === userId);
  });

  // ── Datos para gráficos ─────────────────────────────────────────────────────
  stateChartData = computed(() => ({
    labels: ['Pendiente', 'En progreso', 'Revisión', 'Hecho', 'Bloqueado'],
    datasets: [{
      data: [
        this.ticketsPendiente(), this.ticketsEnProgreso(),
        this.ticketsRevision(), this.ticketsHecho(), this.ticketsBloqueado(),
      ],
      backgroundColor: ['#64748b', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f43f5e'],
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }));

  completionChartData = computed(() => ({
    labels: ['Completado', 'Restante'],
    datasets: [{
      data: [this.ticketsHecho(), this.totalTickets() - this.ticketsHecho()],
      backgroundColor: ['#14b8a6', '#e2e8f0'],
      borderWidth: 0,
    }]
  }));

  priorityChartData = computed(() => ({
    labels: ['Urgente', 'Alta', 'Media', 'Baja'],
    datasets: [{
      data: [
        this.ticketsUrgente(), this.ticketsAlta(),
        this.ticketsMedia(), this.ticketsBaja(),
      ],
      backgroundColor: ['#e11d48', '#f59e0b', '#0284c7', '#94a3b8'],
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }));

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 }
        }
      }
    },
    cutout: '60%',
  };

  // ── Actividad reciente (se carga dinámicamente) ─────────────────────────────
  recentActivity = signal<RecentActivity[]>([]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  async ngOnInit() {
    await this.loadGroups();
  }

  private async loadGroups() {
    this.loading.set(true);

    // Esperar a que hydrateUser termine de cargar el perfil del usuario.
    // Sin este wait, currentUser() puede ser null cuando se llama getGroups().
    let retries = 0;
    while (!this.currentUser()?.id && retries < 20) {
      await new Promise(r => setTimeout(r, 150));
      retries++;
    }

    const groupsRes = await this.auth.getGroups();
    const groups = groupsRes.data ?? [];

    const options: GroupOption[] = groups.map(g => ({
      label: g.name,
      value: g.id,
    }));

    this.groupOptions.set(options);

    // Seleccionar el grupo del usuario si existe, o el primero disponible
    const userGroupId = this.currentUser()?.groupId;
    if (userGroupId && options.some(o => o.value === userGroupId)) {
      this.selectedGroupId.set(userGroupId);
    } else if (options.length > 0) {
      this.selectedGroupId.set(options[0].value);
    }

    if (this.selectedGroupId()) {
      await this.loadTickets(this.selectedGroupId());
    }
    this.loading.set(false);
  }

  private async loadTickets(groupId: string) {
    const response = await this.ticketSvc.getTicketsByGroup(groupId);

    if (response.statusCode === 200 && response.data) {
      this.allTickets.set(response.data);
      this.buildRecentActivity(response.data);
    } else {
      this.allTickets.set([]);
    }
  }

  private buildRecentActivity(tickets: TicketItem[]) {
    const recent = [...tickets]
      .filter(t => !!t.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, 5)
      .map(t => {
        const stateColor: Record<string, string> = {
          'Pendiente': '#64748b',
          'En progreso': '#0ea5e9',
          'Revisión': '#8b5cf6',
          'Hecho': '#14b8a6',
          'Bloqueado': '#f43f5e',
        };
        return {
          icon: 'pi pi-ticket',
          title: t.title,
          detail: `Estado: ${t.state} · Prioridad: ${t.priority}`,
          time: this.relativeTime(t.createdAt ?? ''),
          color: stateColor[t.state] ?? '#64748b',
        };
      });

    this.recentActivity.set(recent);
  }

  private relativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Hace menos de 1h';
    if (h < 24) return `Hace ${h}h`;
    const d = Math.floor(h / 24);
    return `Hace ${d}d`;
  }

  // ── Acciones ───────────────────────────────────────────────────────────────
  async onGroupChange(groupId: string) {
    this.selectedGroupId.set(groupId);
    this.loading.set(true);
    await this.loadTickets(groupId);
    this.loading.set(false);
  }

  selectedGroupLabel(): string {
    return this.groupOptions().find(g => g.value === this.selectedGroupId())?.label ?? '';
  }

  navigateToKanban() {
    const gId = this.selectedGroupId();
    if (gId) this.router.navigate(['/home/groups', gId]);
  }

  navigateToAdmin()   { this.router.navigate(['/home/admin-users']); }
  navigateToProfile() { this.router.navigate(['/home/users']); }

  // ── Helpers de UI ──────────────────────────────────────────────────────────
  getStateSeverity(state: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (state) {
      case 'Pendiente':   return 'info';
      case 'En progreso': return 'warn';
      case 'Revisión':    return 'warn';
      case 'Hecho':       return 'success';
      case 'Bloqueado':   return 'danger';
      default: return 'secondary';
    }
  }

  getPrioritySeverity(p: string): 'danger' | 'warn' | 'info' | 'success' | 'secondary' {
    if (p === 'Urgente' || p === 'Alta') return 'danger';
    if (p === 'Media Alta' || p === 'Media') return 'warn';
    if (p === 'Media Baja') return 'info';
    return 'success';
  }

  getStatusSeverity(s: string): 'success' | 'warn' | 'danger' {
    if (s === 'Activo') return 'success';
    if (s === 'Pausado') return 'warn';
    return 'danger';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get todayFormatted(): string {
    return new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}
