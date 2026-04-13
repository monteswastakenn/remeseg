# Contexto del Proyecto: Sistema de Gestión de Tickets y Usuarios (Angular + Supabase)

Este documento contiene el contexto técnico y funcional del proyecto actual. Puedes proporcionar este texto a cualquier IA para que entienda la arquitectura, el stack tecnológico y la lógica de negocio antes de solicitarle modificaciones o nuevas implementaciones.

## 1. Visión General
El proyecto es una aplicación web single-page (SPA) orientada a la gestión de usuarios, grupos y tickets de soporte/trabajo. Cuenta con un sistema interno de **Control de Acceso Basado en Roles (RBAC)** altamente granular, protegiendo rutas y vistas de acuerdo a los permisos específicos del grupo al que pertenece un usuario.

## 2. Stack Tecnológico
- **Framework Frontend**: Angular (versión 20) utilizando la API reactiva más reciente (`Signals`).
- **Librería de Componentes (UI)**: PrimeNG (versión 20) junto con PrimeIcons.
- **Backend as a Service (BaaS)**: Supabase (versión 2.101.0).
- **Estilos**: CSS nativo y utilidades de Angular, integrando temas de PrimeNG.
- **Lenguaje**: TypeScript.

## 3. Arquitectura y Estructura del Código
La aplicación sigue una estructura modular estándar de Angular en `src/app/`:
- `components/`: Componentes compartidos y reutilizables.
- `guards/`: Contiene `authGuard`, encargado de verificar si el usuario tiene sesión activa y si posee los permisos necesarios para acceder a la ruta.
- `layout/`: Vistas estructurales (como `MainLayout`), que engloban barra lateral (`sidebar`) u otros elementos contenedores compartidos en zonas privadas.
- `pages/`: Vistas principales enlazadas a las rutas. Separadas funcionalmente:
  - `auth/`: `login` y `register`.
  - `landing/`: Vista pública inicial.
  - `home/`: Panel principal autenticado, que incluye `dashboard`, `users`, `admin-users` y `groups/group-tickets`.
- `services/`: Servicios inyectables, notablemente `auth.service.ts` y `supabase.service.ts`.

## 4. Estado de la Autenticación y Autorización
La aplicación se apoya fuertemente en **Supabase Auth** para la creación de cuentas y sesiones, pero extiende esta lógica con tablas propias en la base de datos para manejar roles:
- **Gestión de Sesión**: La sesión y el estado autenticado del usuario se mantienen mediante Angular Signals (`currentUser = signal<...>(null)` en `AuthService`).
- **Modelo de Datos en Base de Datos (Supabase)**:
  - Tabla `users`: Extiende la autenticación base conteniendo `id` (ligado a Supabase Auth), `email`, `full_name`, `password_hash`, y `group_id`.
  - Tabla `permissions`: Define qué recursos (ej. `user`, `users`, `ticket`, `group`) puede operar cada grupo (`group_id`). Tiene columnas booleanas: `can_view`, `can_create`, `can_edit`, `can_delete`.
- **RBAC Integrado**: Los permisos de la base de datos se mapean a cadenas estrictas en Angular (ej. `'ticket:view'`, `'group:edit'`). El Guardian de Rutas (`authGuard`) revisita si el array de permisos en memoria del `currentUser` contiene las variables definidas en la propiedad `data: { permission: '...' }` del `app.routes.ts`.

## 5. Árbol de Rutas Actual
1. **Rutas Públicas:**
   - `/` : Landing page.
   - `/login` : Inicio de sesión.
   - `/register` : Registro de nuevas cuentas.
2. **Rutas Protegidas (Bajo `/home` con `MainLayout`):**
   - `/home/dashboard` : Panel general por defecto.
   - `/home/users` : Gestión o vista de usuarios (requiere permiso `user:view`).
   - `/home/admin-users` : Administración global de usuarios (requiere permiso `users:view`).
   - `/home/groups/:groupId` : Vista de tickets asignados a un grupo específico (requiere permiso `ticket:view`).

## 6. Siguientes Pasos o Posibles Interacciones
*(Al interactuar con otra IA, puedes copiar este fragmento desde arriba y acompañarlo con tu petición específica, por ejemplo: "Teniendo en cuenta el contexto anterior, ayúdame a implementar la funcionalidad de crear tickets en la ruta de '/home/groups/:groupId'.")*
