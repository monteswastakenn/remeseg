import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';

import { AuthService, DbUser, DbGroup, DbPermission } from '../../../services/auth.service';

/** Interfaz de edición en el diálogo */
interface EditForm {
    full_name: string;
    puesto: string;
    group_id: string | null;
}

/** Estructura visual de un permiso editable */
interface PermRow {
    id: string;
    resource: string;
    label: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
    ticket: 'Tickets',
    group: 'Grupos',
    user: 'Usuarios',
};

import { PermissionService } from '../../../services/permission.service';

@Component({
    selector: 'app-admin-users',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TableModule, ButtonModule, TagModule,
        DialogModule, InputTextModule, SelectModule, DividerModule,
        ToggleSwitchModule, TooltipModule, CheckboxModule,
        ConfirmDialogModule, ToastModule, SkeletonModule,
    ],
    providers: [ConfirmationService, MessageService],
    templateUrl: './admin-users.html',
    styleUrls: ['./admin-users.css']
})
export class AdminUsers implements OnInit {
    private auth       = inject(AuthService);
    public permissions = inject(PermissionService);
    private confirmSvc = inject(ConfirmationService);
    private msg        = inject(MessageService);

    loading = signal(true);
    users   = signal<DbUser[]>([]);
    groups  = signal<DbGroup[]>([]);

    // ── Diálogo editar usuario ───────────────────────────────────────────────
    editDialogVisible = false;
    editingUser: DbUser | null = null;
    form: EditForm = { full_name: '', puesto: '', group_id: null };
    saving = signal(false);

    // ── Diálogo editar permisos ──────────────────────────────────────────────
    permDialogVisible = false;
    permDialogUser: DbUser | null = null;
    permDialogGroupName = '';
    groupPerms = signal<PermRow[]>([]);
    loadingPerms = signal(false);
    savingPerms = signal(false);

    // Búsqueda
    searchQuery = '';

    groupOptions = computed(() => [
        { label: '— Sin grupo —', value: '' },
        ...this.groups().map(g => ({ label: g.name, value: g.id }))
    ]);

    filteredUsers = computed(() => {
        const q = this.searchQuery.toLowerCase();
        if (!q) return this.users();
        return this.users().filter(u =>
            u.full_name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.puesto ?? '').toLowerCase().includes(q) ||
            this.getGroupName(u.group_id).toLowerCase().includes(q)
        );
    });

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        this.loading.set(true);
        const [usersRes, groupsRes] = await Promise.all([
            this.auth.getUsers(),
            this.auth.getGroups(),
        ]);
        this.users.set(usersRes.data ?? []);
        this.groups.set(groupsRes.data ?? []);
        this.loading.set(false);
    }

    getGroupName(groupId: string | null): string {
        if (!groupId) return '—';
        return this.groups().find(g => g.id === groupId)?.name ?? '—';
    }

    // ═══ Diálogo: Editar información del usuario ════════════════════════════

    openEdit(user: DbUser) {
        this.editingUser = user;
        this.form = {
            full_name: user.full_name,
            puesto:    user.puesto ?? '',
            group_id:  user.group_id,
        };
        this.editDialogVisible = true;
    }

    async saveUser() {
        if (!this.editingUser) return;
        this.saving.set(true);

        const result = await this.auth.updateUser(this.editingUser.id, {
            full_name: this.form.full_name.trim(),
            puesto:    this.form.puesto.trim() || null,
            group_id:  this.form.group_id || null,
        });

        if (result.statusCode === 200) {
            this.users.update(list =>
                list.map(u => u.id === this.editingUser!.id
                    ? {
                        ...u,
                        full_name: this.form.full_name,
                        puesto:    this.form.puesto || null,
                        group_id:  this.form.group_id || null,
                    }
                    : u
                )
            );
            this.msg.add({ severity: 'success', summary: 'Guardado', detail: `${this.form.full_name} actualizado.`, life: 3000 });
            this.editDialogVisible = false;
        } else {
            this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar.', life: 5000 });
        }

        this.saving.set(false);
    }

    // ═══ Diálogo: Editar permisos del grupo del usuario ═════════════════════

    async openPermissions(user: DbUser) {
        this.permDialogUser = user;
        this.permDialogGroupName = this.getGroupName(user.group_id);
        this.permDialogVisible = true;
        this.groupPerms.set([]);

        if (user.group_id) {
            await this.loadGroupPerms(user.group_id);
        }
    }

    private async loadGroupPerms(groupId: string) {
        this.loadingPerms.set(true);
        const res = await this.auth.getGroupPermissions(groupId);
        const rows = res.data ?? [];
        this.groupPerms.set(this.toPermRows(rows));
        this.loadingPerms.set(false);
    }

    private toPermRows(rows: DbPermission[]): PermRow[] {
        return rows.map(r => ({
            id:         r.id ?? '',
            resource:   r.resource,
            label:      RESOURCE_LABELS[r.resource] ?? r.resource,
            can_view:   r.can_view,
            can_create: r.can_create,
            can_edit:   r.can_edit,
            can_delete: r.can_delete,
        }));
    }

    async togglePerm(perm: PermRow, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') {
        if (!perm.id) return;

        // Como usamos [(ngModel)], p-toggleSwitch YA actualizó perm[field] con el nuevo valor.
        const newValue = perm[field];

        const result = await this.auth.updatePermission(perm.id, { [field]: newValue });
        if (result.statusCode !== 200) {
            perm[field] = !newValue; // revertir en caso de error
            this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el permiso.', life: 3000 });
        } else {
            this.msg.add({ severity: 'success', summary: 'Permiso actualizado', detail: `${perm.label}: ${field} → ${newValue ? 'Sí' : 'No'}`, life: 2000 });
            
            // Si el admin acaba de editar su PROPIO grupo, actualizamos sus permisos en vivo (Front-end reactivo)
            const currentUser = this.auth.currentUser();
            if (currentUser && currentUser.groupId === this.permDialogUser?.group_id) {
                // inject PermissionService and call refresh
                // Since PermissionService is easily injectable via inject() in class, let's just do it directly with a local import if needed, or re-hydrate via auth.
                await this.auth.hydrateUser({ user: { id: currentUser.id, email: currentUser.email } } as any);
            }
        }
    }

    /** Activa TODOS los permisos de todos los módulos del grupo */
    async selectAllPerms() {
        const perms = this.groupPerms();
        const fields: Array<keyof Pick<PermRow, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>> =
            ['can_view', 'can_create', 'can_edit', 'can_delete'];

        for (const perm of perms) {
            if (!perm.id) continue;
            const updates: Partial<PermRow> = {};
            let needsUpdate = false;
            for (const f of fields) {
                if (!perm[f]) { updates[f] = true; needsUpdate = true; }
            }
            if (needsUpdate) {
                const result = await this.auth.updatePermission(perm.id, updates as any);
                if (result.statusCode === 200) {
                    for (const f of fields) perm[f] = true;
                }
            }
        }
        // Forzar re-render del signal
        this.groupPerms.set([...perms]);
        this.msg.add({ severity: 'success', summary: 'Permisos activados', detail: 'Todos los permisos han sido habilitados.', life: 2500 });

        const currentUser = this.auth.currentUser();
        if (currentUser && currentUser.groupId === this.permDialogUser?.group_id) {
            await this.auth.hydrateUser({ user: { id: currentUser.id, email: currentUser.email } } as any);
        }
    }

    /** Desactiva TODOS los permisos de todos los módulos del grupo */
    async clearAllPerms() {
        const perms = this.groupPerms();
        const fields: Array<keyof Pick<PermRow, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>> =
            ['can_view', 'can_create', 'can_edit', 'can_delete'];

        for (const perm of perms) {
            if (!perm.id) continue;
            const updates: Partial<PermRow> = {};
            let needsUpdate = false;
            for (const f of fields) {
                if (perm[f]) { updates[f] = false; needsUpdate = true; }
            }
            if (needsUpdate) {
                const result = await this.auth.updatePermission(perm.id, updates as any);
                if (result.statusCode === 200) {
                    for (const f of fields) perm[f] = false;
                }
            }
        }
        this.groupPerms.set([...perms]);
        this.msg.add({ severity: 'warn', summary: 'Permisos removidos', detail: 'Todos los permisos han sido deshabilitados.', life: 2500 });

        const currentUser = this.auth.currentUser();
        if (currentUser && currentUser.groupId === this.permDialogUser?.group_id) {
            await this.auth.hydrateUser({ user: { id: currentUser.id, email: currentUser.email } } as any);
        }
    }

    // ═══ Eliminar usuario ═══════════════════════════════════════════════════

    confirmDelete(user: DbUser, event: Event) {
        this.confirmSvc.confirm({
            target: event.target as EventTarget,
            message: `¿Eliminar a "${user.full_name}" (${user.email})?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            rejectLabel: 'Cancelar',
            acceptLabel: 'Eliminar',
            acceptButtonStyleClass: 'p-button-danger',
            accept: async () => {
                const result = await this.auth.deleteUser(user.id);
                if (result.statusCode === 200) {
                    this.users.update(list => list.filter(u => u.id !== user.id));
                    this.msg.add({ severity: 'success', summary: 'Eliminado',
                        detail: `${user.email} fue eliminado.`, life: 3000 });
                } else {
                    this.msg.add({ severity: 'error', summary: 'Error',
                        detail: 'No se pudo eliminar el usuario.', life: 3000 });
                }
            }
        });
    }

    // ═══ Helpers UI ═════════════════════════════════════════════════════════

    permSeverity(val: boolean): 'success' | 'danger' { return val ? 'success' : 'danger'; }
    permIcon(val: boolean): string { return val ? 'pi pi-check' : 'pi pi-times'; }
    permLabel(val: boolean): string { return val ? 'Sí' : 'No'; }
}
