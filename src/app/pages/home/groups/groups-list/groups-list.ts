import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { BadgeModule } from 'primeng/badge';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../../services/auth.service';
import { TicketService, TicketItem } from '../../../../services/ticket.service';

interface GroupSummary {
  id: string;
  name: string;
  description: string;
  totalTickets: number;
  pendiente: number;
  enProgreso: number;
  revision: number;
  hecho: number;
  bloqueado: number;
  memberCount?: number;
}

@Component({
  selector: 'app-groups-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    ButtonModule, CardModule, TagModule, SkeletonModule, ToastModule, BadgeModule,
  ],
  providers: [MessageService],
  templateUrl: './groups-list.html',
  styleUrls: ['./groups-list.css'],
})
export class GroupsList implements OnInit {
  private auth      = inject(AuthService);
  private ticketSvc = inject(TicketService);
  private router    = inject(Router);

  currentUser = this.auth.currentUser;
  loading = signal(true);
  groups  = signal<GroupSummary[]>([]);

  async ngOnInit() {
    // Esperar que el usuario esté hidratado
    let retries = 0;
    while (!this.currentUser()?.id && retries < 20) {
      await new Promise(r => setTimeout(r, 150));
      retries++;
    }

    await this.loadGroups();
  }

  async loadGroups() {
    this.loading.set(true);

    const groupsRes = await this.auth.getGroups();
    const rawGroups = groupsRes.data ?? [];

    // Cargar tickets de cada grupo en paralelo
    const summaries = await Promise.all(
      rawGroups.map(async (g): Promise<GroupSummary> => {
        const res = await this.ticketSvc.getTicketsByGroup(g.id);
        const tickets: TicketItem[] = res.data ?? [];

        return {
          id: g.id,
          name: g.name,
          description: g.description ?? 'Sin descripción',
          totalTickets: tickets.length,
          pendiente:  tickets.filter(t => t.state === 'Pendiente').length,
          enProgreso: tickets.filter(t => t.state === 'En progreso').length,
          revision:   tickets.filter(t => t.state === 'Revisión').length,
          hecho:      tickets.filter(t => t.state === 'Hecho').length,
          bloqueado:  tickets.filter(t => t.state === 'Bloqueado').length,
        };
      })
    );

    this.groups.set(summaries);
    this.loading.set(false);
  }

  openKanban(groupId: string) {
    this.router.navigate(['/home/groups', groupId]);
  }

  completionRate(g: GroupSummary): number {
    if (!g.totalTickets) return 0;
    return Math.round((g.hecho / g.totalTickets) * 100);
  }

  skeletons = [1, 2, 3];
}
