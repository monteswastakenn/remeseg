import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

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

import { AuthService } from '../../../../services/auth.service';

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

interface GroupItem {
  id: string;
  nombre: string;
}

interface TicketItem {
  id: string;
  groupId: string;
  title: string;
  state: 'Pendiente' | 'En progreso' | 'Revisión' | 'Hecho' | 'Bloqueado';
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
  selector: 'app-group-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    SelectModule,
    ButtonModule,
    CardModule,
    TagModule,
    AvatarModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TableModule,
    SelectButtonModule
  ],
  templateUrl: './group-tickets.html',
  styleUrls: ['./group-tickets.css'],
})
export class GroupTickets implements OnInit {
  private auth = inject(AuthService);
  currentUser = this.auth.currentUser()!;

  groups: GroupItem[] = [
    { id: 'G-001', nombre: 'Administradores' },
    { id: 'G-002', nombre: 'Ventas' },
    { id: 'G-003', nombre: 'Soporte' },
    { id: 'G-004', nombre: 'Desarrollo' }
  ];

  selectedGroup: GroupItem | null = null;

  allTickets: TicketItem[] = [
    { id: 'TCK-001', groupId: 'G-004', title: 'Fix login bug', state: 'Pendiente', createdBy: 'pansotic29@gmail.com', assignee: 'pansotic29@gmail.com', priority: 'Urgente', createdAt: '2026-03-09', comments: [], history: [{ actor: 'pansotic29@gmail.com', action: 'Creado', date: '2026-03-09T09:00:00Z' }] },
    { id: 'TCK-002', groupId: 'G-002', title: 'Update CRM profile', state: 'En progreso', createdBy: 'pansotic29@gmail.com', assignee: 'ventas@ejemplo.com', priority: 'Media', createdAt: '2026-03-08', comments: [], history: [] },
    { id: 'TCK-003', groupId: 'G-004', title: 'Design new dashboard', state: 'Revisión', createdBy: 'usuario@ejemplo.com', assignee: 'pansotic29@gmail.com', priority: 'Baja', createdAt: '2026-03-01', comments: [], history: [] },
    { id: 'TCK-004', groupId: 'G-003', title: 'Support client login issue', state: 'Hecho', createdBy: 'soporte@ejemplo.com', assignee: 'soporte@ejemplo.com', priority: 'Media Alta', createdAt: '2026-02-25', comments: [], history: [] },
    { id: 'TCK-005', groupId: 'G-004', title: 'Investigate DB slow queries', state: 'Bloqueado', createdBy: 'pansotic29@gmail.com', assignee: 'pansotic29@gmail.com', priority: 'Urgente', createdAt: '2026-03-09', comments: [], history: [] },
    { id: 'TCK-006', groupId: 'G-001', title: 'Add new user permissions', state: 'Pendiente', createdBy: 'admin@ejemplo.com', assignee: 'admin@ejemplo.com', priority: 'Media', createdAt: '2026-03-10', comments: [], history: [] },
    { id: 'TCK-007', groupId: 'G-003', title: 'Network outage report', state: 'En progreso', createdBy: 'pansotic29@gmail.com', assignee: 'soporte@ejemplo.com', priority: 'Alta', createdAt: '2026-03-10', comments: [], history: [] }
  ];

  pendiente: TicketItem[] = [];
  enProgreso: TicketItem[] = [];
  revision: TicketItem[] = [];
  hecho: TicketItem[] = [];
  bloqueado: TicketItem[] = [];

  connectedLists = ['pendienteList', 'enProgresoList', 'revisionList', 'hechoList', 'bloqueadoList'];

  stateOptions = [
    { label: 'Pendiente', value: 'Pendiente' },
    { label: 'En progreso', value: 'En progreso' },
    { label: 'Revisión', value: 'Revisión' },
    { label: 'Hecho', value: 'Hecho' },
    { label: 'Bloqueado', value: 'Bloqueado' }
  ];

  priorityOptions = [
    { label: 'Urgente', value: 'Urgente' },
    { label: 'Alta', value: 'Alta' },
    { label: 'Media Alta', value: 'Media Alta' },
    { label: 'Media', value: 'Media' },
    { label: 'Media Baja', value: 'Media Baja' },
    { label: 'Baja (Baja)', value: 'Baja (Baja)' },
    { label: 'Muy Baja (Muy Baja)', value: 'Muy Baja (Muy Baja)' }
  ];

  viewModeOptions = [
    { label: 'Tablero', value: 'kanban', icon: 'pi pi-objects-column' },
    { label: 'Lista', value: 'list', icon: 'pi pi-list' }
  ];
  viewMode: 'kanban' | 'list' = 'kanban';

  editDialogVisible = false;
  selectedTicket: TicketItem | null = null;
  editingTicket: Partial<TicketItem> = {};
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

  ngOnInit() { }

  onGroupChange() {
    this.refreshGroupTickets();
  }

  get totalTickets() {
    if (!this.selectedGroup) return 0;
    return this.pendiente.length + this.enProgreso.length + this.revision.length + this.hecho.length + this.bloqueado.length;
  }

  refreshGroupTickets() {
    if (!this.selectedGroup) {
      this.pendiente = [];
      this.enProgreso = [];
      this.revision = [];
      this.hecho = [];
      this.bloqueado = [];
      return;
    }

    const groupTickets = this.allTickets.filter(t => t.groupId === this.selectedGroup!.id);

    this.pendiente = groupTickets.filter(t => t.state === 'Pendiente');
    this.enProgreso = groupTickets.filter(t => t.state === 'En progreso');
    this.revision = groupTickets.filter(t => t.state === 'Revisión');
    this.hecho = groupTickets.filter(t => t.state === 'Hecho');
    this.bloqueado = groupTickets.filter(t => t.state === 'Bloqueado');
  }

  drop(event: CdkDragDrop<TicketItem[]>) {
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

      const newStatusId = event.container.id;

      let newState: TicketItem['state'] = 'Pendiente';
      if (newStatusId === 'pendienteList') newState = 'Pendiente';
      else if (newStatusId === 'enProgresoList') newState = 'En progreso';
      else if (newStatusId === 'revisionList') newState = 'Revisión';
      else if (newStatusId === 'hechoList') newState = 'Hecho';
      else if (newStatusId === 'bloqueadoList') newState = 'Bloqueado';

      ticket.state = newState;

      if (oldState !== newState) {
        if (!ticket.history) ticket.history = [];
        ticket.history.unshift({
          actor: this.currentUser.email,
          action: `Movido en tablero de ${oldState} a ${ticket.state}`,
          date: new Date().toISOString()
        });
      }

      // Update in the master list as well
      const index = this.allTickets.findIndex(t => t.id === ticket.id);
      if (index !== -1) {
        this.allTickets[index].state = newState;
      }
    }
  }

  openTicket(ticket: TicketItem) {
    this.selectedTicket = ticket;
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
    if (!this.editingTicket.comments) this.editingTicket.comments = [];
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
      // Sync master list
      const index = this.allTickets.findIndex(t => t.id === this.selectedTicket!.id);
      if (index !== -1) {
        this.allTickets[index] = this.selectedTicket;
      }
      this.refreshGroupTickets();
    }
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  cancelEdit() {
    this.editDialogVisible = false;
    this.selectedTicket = null;
  }

  getPrioritySeverity(priority: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    if (priority === 'Urgente') return 'danger';
    if (priority === 'Alta') return 'danger';
    if (priority === 'Media Alta') return 'warn';
    if (priority === 'Media') return 'warn';
    if (priority === 'Media Baja') return 'info';
    if (priority === 'Baja') return 'success';
    if (priority === 'Muy Baja') return 'secondary';
    return 'info';
  }

  formatDate(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleString();
  }

  createTicket() {
    if (!this.selectedGroup) return;
    alert(`Función para crear nuevo ticket para el grupo: ${this.selectedGroup.nombre}`);
  }
}
