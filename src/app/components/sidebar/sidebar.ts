import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';
import { HasPermissionDirective } from '../../directives/has-permission/has-permission.directive';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    TooltipModule,
    HasPermissionDirective,
  ],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() onToggle?: () => void;

  private auth    = inject(AuthService);
  private permSvc = inject(PermissionService);
  private router  = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  /** Shorthand for template */
  hasPermission(perm: string): boolean {
    return this.permSvc.hasPermission(perm);
  }
}