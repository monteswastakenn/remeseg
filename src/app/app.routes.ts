import { Routes } from '@angular/router';

import { Landing } from './pages/landing/landing';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';

import { MainLayout } from './layout/main-layout/main-layout';
import { Dashboard } from './pages/home/dashboard/dashboard';
import { Users } from './pages/home/users/users';
import { GroupsList } from './pages/home/groups/groups-list/groups-list';
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
            // Dashboard y perfil: solo requieren autenticación (sin permiso específico)
            { path: 'dashboard', component: Dashboard },
            { path: 'users', component: Users },

            // Grupos: requiere permiso general para ver grupos
            { 
                path: 'groups', 
                component: GroupsList,
                canActivate: [authGuard],
                data: { permission: 'group:view' }
            },

            // Kanban de un grupo: requiere permiso ticket:view
            {
                path: 'groups/:groupId',
                component: GroupTickets,
                canActivate: [authGuard],
                data: { permission: 'ticket:view' },
            },

            // Administración de usuarios: requiere permiso para ver la lista de usuarios
            {
                path: 'admin-users',
                component: AdminUsers,
                canActivate: [authGuard],
                data: { permission: 'user:view' }
            },
        ],
    },

    { path: '**', redirectTo: '' },
];