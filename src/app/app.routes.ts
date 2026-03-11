import { Routes } from '@angular/router';

import { Landing } from './pages/landing/landing';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';

import { MainLayout } from './layout/main-layout/main-layout';
import { Dashboard } from './pages/home/dashboard/dashboard';
import { Tickets } from './pages/home/tickets/tickets';
import { Users } from './pages/home/users/users';
import { Groups } from './pages/home/groups/groups';
import { GroupTickets } from './pages/home/groups/group-tickets/group-tickets';
import { AdminUsers } from './pages/home/admin-users/admin-users';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', component: Landing },
    { path: 'login', component: Login },
    { path: 'register', component: Register },

    {
        path: 'home',
        component: MainLayout,
        canActivate: [authGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
            { path: 'dashboard', component: Dashboard },
            { path: 'tickets', component: Tickets, canActivate: [authGuard], data: { permission: 'ticket:view' } },
            { path: 'users', component: Users, canActivate: [authGuard], data: { permission: 'user:view' } },
            { path: 'admin-users', component: AdminUsers, canActivate: [authGuard], data: { permission: 'users:view' } },
            { path: 'groups', component: Groups, canActivate: [authGuard], data: { permission: 'group:view' } },
            { path: 'group-tickets', component: GroupTickets, canActivate: [authGuard], data: { permission: 'group:view' } },
        ],
    },

    { path: '**', redirectTo: '' },
];