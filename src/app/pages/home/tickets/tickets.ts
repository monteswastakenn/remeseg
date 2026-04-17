/**
 * ⚠️ COMPONENTE DEPRECADO
 *
 * Este componente ha sido reemplazado por `GroupTickets` (group-tickets)
 * que conecta directamente con Supabase a través de TicketService + ApiGatewayService.
 *
 * Se mantiene este archivo limpio como referencia.
 * La ruta activa está en: /home/groups/:groupId → GroupTickets
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem; text-align: center; color: var(--text-color-secondary);">
      <i class="pi pi-info-circle" style="font-size: 2rem;"></i>
      <p>Este módulo ha sido migrado a la vista de grupos.</p>
      <p>Navega a <b>Groups → [Grupo] → Kanban</b> para gestionar tickets.</p>
    </div>
  `,
})
export class Tickets {}
