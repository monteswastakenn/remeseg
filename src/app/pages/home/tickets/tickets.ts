import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { SelectButtonModule } from 'primeng/selectbutton';

import { AuthService } from '../../../services/auth.service';

export interface TicketComment {
  author: string;
  text: string;
  date: string;
}

export interface TicketHistory {
  actor: string;
  action: string;
  date: string;
}

export type PriorityLevel = 'Urgente' | 'Alta' | 'Media Alta' | 'Media' | 'Media Baja' | 'Baja' | 'Muy Baja';

export interface Ticket {
  id: string;
  title: string;
  state: 'Pendiente' | 'En progreso' | 'Revisión' | 'Hecho';
  createdBy: string;
  assignee: string;
  priority: PriorityLevel;
  createdAt: string;
  description?: string;
  dueDate?: string;
  llmModel?: string;
  comments: TicketComment[];
  history: TicketHistory[];
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    CardModule,
    ButtonModule,
    TagModule,
    AvatarModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    TableModule,
    SelectButtonModule
  ],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css'],
})
export class Tickets {
  private auth = inject(AuthService);
  currentUser = this.auth.currentUser()!;

  // Initial mocked tickets
  tickets: Ticket[] = [
    {
      id: 'TCK-001', title: 'Fix login bug', state: 'Pendiente', createdBy: 'pansotic29@gmail.com', assignee: 'pansotic29@gmail.com', priority: 'Urgente', createdAt: '2026-03-09', description: 'El botón de login no responde en Safari.', dueDate: '2026-03-12', llmModel: 'gpt-4o',
      comments: [{ author: 'pansotic29@gmail.com', text: 'Esto urge para la release.', date: '2026-03-09T10:00:00Z' }],
      history: [{ actor: 'pansotic29@gmail.com', action: 'Ticket creado', date: '2026-03-09T09:00:00Z' }]
    },
    {
      id: 'TCK-002', title: 'Update user profile', state: 'En progreso', createdBy: 'pansotic29@gmail.com', assignee: 'usuario@ejemplo.com', priority: 'Media', createdAt: '2026-03-08', description: 'Añadir campos de redes sociales al perfil.', dueDate: '2026-03-15', llmModel: 'claude-3.5-sonnet',
      comments: [], history: [{ actor: 'pansotic29@gmail.com', action: 'Ticket creado', date: '2026-03-08T14:20:00Z' }]
    },
    {
      id: 'TCK-003', title: 'Design new dashboard', state: 'Revisión', createdBy: 'usuario@ejemplo.com', assignee: 'pansotic29@gmail.com', priority: 'Baja', createdAt: '2026-03-01', description: 'Revisión de mockups por parte del cliente.', dueDate: '2026-03-20', llmModel: 'gemini-1.5-pro',
      comments: [], history: [{ actor: 'usuario@ejemplo.com', action: 'Ticket creado', date: '2026-03-01T11:00:00Z' }]
    },
    {
      id: 'TCK-004', title: 'Add export to CSV', state: 'Hecho', createdBy: 'pansotic29@gmail.com', assignee: 'usuario@ejemplo.com', priority: 'Media Alta', createdAt: '2026-02-25', description: 'Exportar la tabla de ventas a formato CSV delimitado por comas.',
      comments: [], history: [{ actor: 'pansotic29@gmail.com', action: 'Ticket creado', date: '2026-02-25T16:45:00Z' }]
    },
    {
      id: 'TCK-005', title: 'Investigate DB slow queries', state: 'Pendiente', createdBy: 'usuario@ejemplo.com', assignee: 'usuario@ejemplo.com', priority: 'Alta', createdAt: '2026-03-09', description: 'La vista de reportes tarda más de 10s en cargar los últimos 3 meses.',
      comments: [], history: [{ actor: 'usuario@ejemplo.com', action: 'Ticket creado', date: '2026-03-09T08:15:00Z' }]
    }
  ];

  activeFilter: 'Mis tickets' | 'Sin asignar' | 'Prioridad Alta' | null = null;

  get filteredTickets() {
    let list = this.tickets;
    if (this.activeFilter === 'Mis tickets') {
      list = list.filter(t => t.assignee === this.currentUser.email);
    } else if (this.activeFilter === 'Sin asignar') {
      list = list.filter(t => !t.assignee);
    } else if (this.activeFilter === 'Prioridad Alta') {
      list = list.filter(t => t.priority === 'Urgente' || t.priority === 'Alta');
    }
    return list;
  }

  // Logic to separate tickets into columns
  get pendiente() { return this.filteredTickets.filter(t => t.state === 'Pendiente'); }
  get enProgreso() { return this.filteredTickets.filter(t => t.state === 'En progreso'); }
  get revision() { return this.filteredTickets.filter(t => t.state === 'Revisión'); }
  get hecho() { return this.filteredTickets.filter(t => t.state === 'Hecho'); }

  connectedLists = ['pendienteList', 'enProgresoList', 'revisionList', 'hechoList'];

  stateOptions = [
    { label: 'Pendiente', value: 'Pendiente' },
    { label: 'En progreso', value: 'En progreso' },
    { label: 'Revisión', value: 'Revisión' },
    { label: 'Hecho', value: 'Hecho' }
  ];

  priorityOptions = [
    { label: 'Urgente', value: 'Urgente' },
    { label: 'Alta', value: 'Alta' },
    { label: 'Media Alta', value: 'Media Alta' },
    { label: 'Media', value: 'Media' },
    { label: 'Media Baja', value: 'Media Baja' },
    { label: 'Baja', value: 'Baja' },
    { label: 'Muy Baja', value: 'Muy Baja' }
  ];

  viewModeOptions = [
    { label: 'Tablero', value: 'kanban', icon: 'pi pi-objects-column' },
    { label: 'Lista', value: 'list', icon: 'pi pi-list' }
  ];
  viewMode: 'kanban' | 'list' = 'kanban';

  createDialogVisible = false;
  newTicket: Partial<Ticket> = {};

  editDialogVisible = false;
  selectedTicket: Ticket | null = null;
  editingTicket: Partial<Ticket> = {};
  newCommentText: string = '';

  private originalStateForEdit: any = {};

  get canEditFull(): boolean {
    if (!this.selectedTicket) return false;
    return this.currentUser.email === this.selectedTicket.createdBy;
  }

  get canEditStatusOnly(): boolean {
    if (!this.selectedTicket) return false;
    return this.currentUser.email === this.selectedTicket.assignee && !this.canEditFull;
  }

  openCreateTicket() {
    this.newTicket = {
      title: '',
      description: '',
      state: 'Pendiente',
      assignee: this.currentUser.email,
      priority: 'Media',
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.createDialogVisible = true;
  }

  confirmCreateTicket() {
    if (!this.newTicket.title) return; // Basic validation

    const created: Ticket = {
      id: `TCK-${Math.floor(Math.random() * 900) + 100}`,
      title: this.newTicket.title || 'Nuevo Ticket',
      state: this.newTicket.state as any || 'Pendiente',
      createdBy: this.currentUser.email,
      assignee: this.newTicket.assignee || '',
      priority: this.newTicket.priority as any || 'Media',
      createdAt: new Date().toISOString().split('T')[0],
      description: this.newTicket.description,
      comments: [],
      history: [{ actor: this.currentUser.email, action: 'Ticket creado', date: new Date().toISOString() }]
    };

    // Replace the array reference so computed/getters recalculate
    this.tickets = [created, ...this.tickets];
    this.createDialogVisible = false;

    // Automatically open the detail view of the new ticket
    this.openTicket(created);
  }

  openTicket(ticket: Ticket) {
    this.selectedTicket = ticket;
    // Clone deeply to avoid mutating immediately
    this.editingTicket = JSON.parse(JSON.stringify(ticket));
    this.originalStateForEdit = { ...ticket };
    this.newCommentText = '';
    this.editDialogVisible = true;
  }

  addComment() {
    if (!this.newCommentText.trim() || !this.editingTicket) return;
    const comment: TicketComment = {
      author: this.currentUser.email,
      text: this.newCommentText,
      date: new Date().toISOString()
    };
    if (!this.editingTicket.comments) {
      this.editingTicket.comments = [];
    }
    this.editingTicket.comments.push(comment);
    this.newCommentText = '';
  }

  saveTicket() {
    if (this.selectedTicket) {
      const now = new Date().toISOString();
      const changes: string[] = [];

      if (this.originalStateForEdit.state !== this.editingTicket.state) {
        changes.push(`Estado de ${this.originalStateForEdit.state} a ${this.editingTicket.state}`);
      }
      if (this.originalStateForEdit.assignee !== this.editingTicket.assignee) {
        changes.push(`Asignado cambiado a ${this.editingTicket.assignee}`);
      }
      if (this.originalStateForEdit.priority !== this.editingTicket.priority) {
        changes.push(`Prioridad de ${this.originalStateForEdit.priority} a ${this.editingTicket.priority}`);
      }

      if (changes.length > 0) {
        if (!this.editingTicket.history) this.editingTicket.history = [];
        this.editingTicket.history.unshift({
          actor: this.currentUser.email,
          action: changes.join(', '),
          date: now
        });
      }

      Object.assign(this.selectedTicket, this.editingTicket);
    }
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  cancelEdit() {
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  drop(event: CdkDragDrop<Ticket[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const ticket = event.previousContainer.data[event.previousIndex];
      const oldState = ticket.state;

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update the ticket state when moved
      const newStatusId = event.container.id;

      if (newStatusId === 'pendienteList') ticket.state = 'Pendiente';
      else if (newStatusId === 'enProgresoList') ticket.state = 'En progreso';
      else if (newStatusId === 'revisionList') ticket.state = 'Revisión';
      else if (newStatusId === 'hechoList') ticket.state = 'Hecho';

      if (oldState !== ticket.state) {
        if (!ticket.history) ticket.history = [];
        ticket.history.unshift({
          actor: this.currentUser.email,
          action: `Movido en tablero de ${oldState} a ${ticket.state}`,
          date: new Date().toISOString()
        });
      }
    }
  }

  getPrioritySeverity(priority: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    // 极高 (Crítica)
    if (priority.includes('极高')) return 'danger';
    // 高 (Alta)
    if (priority.includes('高') && !priority.includes('中高')) return 'danger';
    // 中高 (Media Alta)
    if (priority.includes('中高')) return 'warn';
    // 中 (Media)
    if (priority.includes('中') && !priority.includes('中高') && !priority.includes('中低')) return 'warn';
    // 中低 (Media Baja)
    if (priority.includes('中低')) return 'info';
    // 低 (Baja)
    if (priority.includes('低') && !priority.includes('中低') && !priority.includes('极低')) return 'success';
    // 极低 (Muy Baja)
    if (priority.includes('极低')) return 'secondary';

    return 'info';
  }

  formatDate(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleString();
  }
}


