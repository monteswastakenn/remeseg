# 🔍 Auditoría Exhaustiva — Práctica 10

## Resumen Ejecutivo

Proyecto Angular 20 + Supabase + PrimeNG. Arquitectura RBAC implementada. **Cumplimiento ~65-70%**. Errores críticos: datos mock sin eliminar, rutas sin `data.permission`, `moveTicket()` definida pero nunca usada, y componente `groups.ts` 100% hardcoded.

---

## I. Tabla de Cumplimiento

| # | Requerimiento | Estado | Observación Técnica |
|---|---|---|---|
| 1 | **API Gateway centralizado** (proxy Fastify emulado) | ✅ Cumplido | `api-gateway.service.ts` valida token + permiso antes de cada CRUD. Métodos `query`, `insert`, `update`, `delete` todos con `preCheck()`. |
| 2 | **Esquema JSON Universal** `{ statusCode, intOpCode, data }` | ⚠️ Parcial | `ApiResponse` model correcto en [api-response.model.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/models/api-response.model.ts). `TicketService` cumple. **PERO** `AuthService` (L138-208) devuelve `DbUser[]`, `DbGroup[]`, `boolean` directos — **NO** envuelve en `ApiResponse`. Métodos: `getUsers()`, `getGroups()`, `updateUserGroup()`, `updateUser()`, `getGroupPermissions()`. |
| 3 | **Códigos tipo SxUS200 / SxTI200** | ⚠️ Parcial | `ApiGatewayService.opCode()` genera formato correcto. `TicketService` usa `SxTI200/201/401/403/500`. Pero `AuthService` no genera ningún intOpCode. |
| 4 | **Eliminación de Mocks** | ❌ No Cumplido | **3 archivos con datos hardcodeados:** |
| | | | • [tickets.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/tickets/tickets.ts#L73-L96) — L73-96: 5 tickets mock (`TCK-001` a `TCK-005`) |
| | | | • [users.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/users/users.ts#L128-L187) — L128-147: `getUserSafe()` con fallbacks hardcoded (`phone: '6145288424'`, `address`, `birthDate`). L149-187: 4 tickets mock (`TK-1001` a `TK-1004`) |
| | | | • [groups.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/groups/groups.ts#L66-L141) — L66-71: `groupIdMap` hardcoded. L92-141: 4 grupos mock (Administradores, Ventas, Soporte, Invitados). **Todo el CRUD es local**, no toca Supabase. |
| 5 | **Seguridad RBAC — directiva `appHasPermission`** | ✅ Cumplido | [has-permission.directive.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/directives/has-permission/has-permission.directive.ts) usa `ViewContainerRef.clear()` → **elimina del DOM**, no oculta con CSS. Soporta `else` template. Reactiva con `effect()`. |
| 6 | **Uso de directiva en templates** | ⚠️ Parcial | Solo usada en `group-tickets.html` (3 usos) y `dashboard.html` (1 uso). **NO** se usa en `groups.html`, `users.html`, `admin-users.html`. Falta proteger botones/acciones con permisos en esas vistas. |
| 7 | **authGuard con permiso por ruta** | ❌ No Cumplido | Guard existe y funciona, **PERO** `app.routes.ts` no define `data: { permission: '...' }` en **ninguna** ruta hija. Solo el guard del doccomment muestra un ejemplo, pero no está actualizada en las rutas reales. Todas las rutas hijas de `/home` NO tienen permiso requerido. |
| 8 | **Función editState (pizarrón)** | ⚠️ Parcial | No existe función llamada `editState`. Existe `moveTicket()` en [ticket.service.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/services/ticket.service.ts#L166-L196) L166-196 que valida `ticket:change_status` + ownership del assignee. **PERO `moveTicket()` NUNCA se llama.** `group-tickets.ts` L191 usa `updateTicket()` directamente en el drag-and-drop, saltando la validación de ownership. |
| 9 | **Reglas de negocio Kanban** | ❌ No Cumplido | Requerimiento: bloquear movimiento si no tiene permiso `ticket:move` O no está asignado. Implementación actual: `group-tickets.ts` L172 verifica `ticket:change_status` pero NO verifica si ticket está asignado al usuario. La función `moveTicket()` en service SÍ lo verifica, pero no se usa. |
| 10 | **UX sin `window.alert()`** | ✅ Cumplido | 0 apariciones de `alert()` o `window.alert()`. Todos los componentes usan `p-toast` vía `MessageService`. `p-confirmdialog` en admin-users. |
| 11 | **Login real con Supabase** | ✅ Cumplido | `AuthService.login()` usa `signInWithPassword`. Registro con `signUp`. Session restore con `getSession()` + `onAuthStateChange`. |
| 12 | **PermissionService** | ✅ Cumplido | Servicio dedicado con `hasPermission()`, `hasAllPermissions()`, `hasAnyPermission()`, `refreshPermissionsForGroup()`. Lee desde Supabase. |
| 13 | **Fallback permisos sin grupo** | ⚠️ Parcial | [auth.service.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/services/auth.service.ts#L234-L237) L234-237: Si usuario no tiene `group_id` o permisos = 0, le da **TODOS los permisos** (`ALL_PERMISSIONS`). Esto es un **agujero de seguridad** grave. Un usuario sin grupo tendría acceso total. |

---

## II. Problemas Críticos Detectados

### 🔴 CRÍTICO 1: `tickets.ts` — Componente 100% Mock

**Ubicación**: [tickets.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/tickets/tickets.ts) — **TODO el archivo**

Este componente NO se conecta a Supabase. Tiene:
- 5 tickets hardcoded (L74-96)
- CRUD local (no persiste)
- No usa `TicketService` ni `ApiGatewayService`
- No usa `appHasPermission` ni `PermissionService`
- No sigue formato `ApiResponse`

> [!WARNING]
> Este componente parece **obsoleto** — fue reemplazado por `group-tickets.ts` que SÍ conecta a Supabase. Pero sigue existiendo y podría ser una ruta activa.

### 🔴 CRÍTICO 2: `groups.ts` — Componente 100% Mock

**Ubicación**: [groups.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/groups/groups.ts) — **TODO el archivo**

- 4 grupos hardcoded (L92-141)
- `groupIdMap` con IDs falsos `G-001`, `G-002`, etc. (L66-71)
- CRUD local (save/remove no tocan Supabase)
- No usa `ApiGatewayService`

> [!NOTE]
> Existe `groups-list.ts` que SÍ carga grupos de Supabase. Verificar si `groups.ts` aún se usa en alguna ruta.

### 🔴 CRÍTICO 3: `users.ts` — Datos Mock Persistentes

**Ubicación**: [users.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/users/users.ts)

- L131: Email fallback hardcoded `'damntic29@gmail.com'`
- L138: `address: 'Querétaro, México'` hardcoded
- L139: `birthDate: '2005-20-01'` hardcoded (fecha inválida: mes 20)
- L141-145: Array de permisos fallback hardcoded
- L149-187: 4 tickets mock (`TK-1001` a `TK-1004`)
- `saveEdit()` solo actualiza localmente, no persiste en Supabase

### 🔴 CRÍTICO 4: `moveTicket()` No Se Usa

**Ubicación**: [ticket.service.ts L166-196](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/services/ticket.service.ts#L166-L196)

`moveTicket()` implementa correctamente las reglas de negocio (permiso + ownership), **pero nunca se invoca**. En [group-tickets.ts L191](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/pages/home/groups/group-tickets/group-tickets.ts#L191), el drag-and-drop llama `updateTicket()` directamente, saltando validación de ownership.

### 🔴 CRÍTICO 5: Rutas Sin `data.permission`

**Ubicación**: [app.routes.ts](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/app.routes.ts#L24-L31)

Ninguna ruta hija define `data: { permission: '...' }`. El `authGuard` solo verifica sesión, nunca permisos de ruta:

```typescript
// Actual (L27-30) — SIN permisos
{ path: 'users', component: Users },
{ path: 'admin-users', component: AdminUsers, canActivate: [authGuard] },
{ path: 'groups', component: GroupsList },
{ path: 'groups/:groupId', component: GroupTickets },
```

### 🟡 ADVERTENCIA: Fallback ALL_PERMISSIONS

**Ubicación**: [auth.service.ts L234-237](file:///c:/Users/matad/OneDrive/Documentos/8vo%20Cuatrimestre/Seguridad/Practica10/src/app/services/auth.service.ts#L234-L237)

```typescript
if (permissions.length === 0) {
    permissions = [...ALL_PERMISSIONS];
}
```

Cualquier usuario sin grupo obtiene **todos** los permisos. Agujero de seguridad.

### 🟡 ADVERTENCIA: `AuthService` No Usa `ApiResponse`

Métodos `getUsers()`, `getGroups()`, `updateUser()`, etc. devuelven tipos primitivos (`DbUser[]`, `boolean`), no `ApiResponse<T>`.

---

## III. Código Corregido

### Fix 1: `app.routes.ts` — Agregar permisos a rutas

```typescript
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
            { path: 'users', component: Users, canActivate: [authGuard], data: { permission: 'user:view' } },
            { path: 'admin-users', component: AdminUsers, canActivate: [authGuard], data: { permission: 'users:view' } },
            { path: 'groups', component: GroupsList, canActivate: [authGuard], data: { permission: 'group:view' } },
            { path: 'groups/:groupId', component: GroupTickets, canActivate: [authGuard], data: { permission: 'ticket:view' } },
        ],
    },

    { path: '**', redirectTo: '' },
];
```

### Fix 2: `group-tickets.ts` L191 — Usar `moveTicket()` en lugar de `updateTicket()`

```typescript
// En drop() — reemplazar línea 191:
// ANTES:
// const result = await this.ticketSvc.updateTicket(ticket.id, { state: newState });

// DESPUÉS:
const result = await this.ticketSvc.moveTicket(ticket.id, newState, ticket.assignee);
```

### Fix 3: `auth.service.ts` L234-237 — Eliminar fallback peligroso

```typescript
// ANTES:
if (permissions.length === 0) {
    permissions = [...ALL_PERMISSIONS];
}

// DESPUÉS:
// Sin fallback — usuario sin grupo = sin permisos
// (Dejar el array vacío, la UI mostrará "sin permisos")
```

### Fix 4: `users.ts` — Eliminar datos mock y cargar de Supabase

> [!IMPORTANT]
> El componente `users.ts` necesita refactorización completa. Los `assignedTickets` mock (L149-187), los fallback hardcoded en `getUserSafe()` (L128-147), y el `saveEdit()` local deben ser reemplazados por llamadas a `TicketService` y `AuthService` con formato `ApiResponse`.

### Fix 5: `groups.ts` — Reemplazar datos mock

> [!IMPORTANT]
> Este componente parece obsoleto — `groups-list.ts` ya carga desde Supabase. Si `groups.ts` aún se usa en alguna ruta, todo el array `groups: GroupRow[]` (L92-141) y el `groupIdMap` (L66-71) deben reemplazarse por consultas a `auth.getGroups()`. El CRUD (`save()`, `remove()`) debe pasar por `ApiGatewayService`.

---

## IV. Resumen Final

| Categoría | Cumplido | Parcial | No Cumplido |
|---|---|---|---|
| Arquitectura Gateway | 1 | 0 | 0 |
| Esquema JSON Universal | 0 | 1 | 0 |
| Eliminación de Mocks | 0 | 0 | 1 |
| RBAC (Directiva) | 1 | 0 | 0 |
| RBAC (Uso en templates) | 0 | 1 | 0 |
| Guard con permisos | 0 | 0 | 1 |
| editState/moveTicket | 0 | 1 | 0 |
| Reglas Kanban | 0 | 0 | 1 |
| UX sin alerts | 1 | 0 | 0 |
| Login real | 1 | 0 | 0 |
| **TOTAL** | **4** | **3** | **3** |

**Porcentaje cumplimiento: ~55%** (4 cumplidos, 3 parciales, 3 no cumplidos de 10 criterios)
