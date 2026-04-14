import {
  Directive,
  effect,
  inject,
  Input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';

/**
 * Directiva estructural **appHasPermission**
 *
 * Elimina o inserta elementos del DOM según los permisos del usuario actual.
 * NO oculta con CSS — **remueve del DOM** (equivale a *ngIf por permisos).
 *
 * ─── Uso básico ────────────────────────────────────────────────────────────
 *
 *   <!-- Permiso simple -->
 *   <button *appHasPermission="'ticket:add'">Crear Ticket</button>
 *
 *   <!-- Bloque else si NO tiene permiso -->
 *   <div *appHasPermission="'users:view'; else noAccess">
 *     Contenido protegido
 *   </div>
 *   <ng-template #noAccess>
 *     <p>Sin permisos</p>
 *   </ng-template>
 *
 * ─── Funcionamiento ────────────────────────────────────────────────────────
 *
 *   1. Escucha reactivamente los cambios en `currentUser` (Signal).
 *   2. Cuando el usuario cambia (login, logout, refresh de permisos):
 *        • Si tiene el permiso → renderiza el template.
 *        • Si NO lo tiene     → limpia el viewContainer (elimina del DOM).
 *        • Si hay template `else` → lo renderiza cuando no tiene permiso.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private templateRef   = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private permissions   = inject(PermissionService);
  private auth          = inject(AuthService);

  /** El permiso requerido (ej: "ticket:add") */
  private requiredPermission = '';

  /** Template alternativo cuando el permiso NO existe */
  private elseTemplateRef: TemplateRef<any> | null = null;

  /** Evita re-renderizar si el estado no cambió */
  private isRendered = false;

  @Input()
  set appHasPermission(permission: string) {
    this.requiredPermission = permission;
    // Debemos llamar updateView porque en ng-template/p-table el Input puede llegar
    // después de que el effect inicial se haya ejecutado.
    this.updateView();
  }

  @Input()
  set appHasPermissionElse(templateRef: TemplateRef<any> | null) {
    this.elseTemplateRef = templateRef;
  }

  constructor() {
    // Effect reactivo: se re-ejecuta cada vez que `currentUser` (Signal) cambia.
    effect(() => {
      // Leer el signal dentro del effect para registrar dependencia.
      const _user = this.auth.currentUser();
      this.updateView();
    });
  }

  private updateView(): void {
    const hasAccess = this.permissions.hasPermission(this.requiredPermission);

    if (hasAccess && !this.isRendered) {
      // Insertar el template principal
      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isRendered = true;
    } else if (!hasAccess && this.isRendered) {
      // Remover del DOM y, opcionalmente, mostrar else
      this.viewContainer.clear();
      if (this.elseTemplateRef) {
        this.viewContainer.createEmbeddedView(this.elseTemplateRef);
      }
      this.isRendered = false;
    } else if (!hasAccess && !this.isRendered) {
      // Estado inicial sin permiso
      this.viewContainer.clear();
      if (this.elseTemplateRef) {
        this.viewContainer.createEmbeddedView(this.elseTemplateRef);
      }
    }
  }
}
