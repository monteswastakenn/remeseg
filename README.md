Aplicación web frontend y backend (BaaS) desarrollada con **Angular 21**, **PrimeNG 21** y **Supabase** como parte de la materia de Seguridad del 8vo cuatrimestre.

---

## 📋 Descripción General

Este proyecto se ha desarrollado de forma incremental a lo largo de múltiples prácticas. Comenzó como una configuración inicial del entorno de desarrollo (Práctica 1), evolucionó a una SPA con sistema de autenticación simulado (Práctica 2 y 3), se extendió con estructura de layout y Sidebar (Práctica 4) y sub-rutas dinámicas (Práctica 5). Tras una limpieza de entorno (Práctica 7), se sentaron las bases de un **sistema de Control de Acceso (RBAC)** con Signals y directivas (Práctica 8). 

Finalmente, en las **Prácticas 9 y 10**, la aplicación dio el salto a la persistencia real, integrando **Supabase** como Backend-as-a-Service para manejar autenticación y bases de datos relacionales (PostgreSQL). Se reemplazaron todos los datos *mockeados* por consultas reales, y se construyó un sofisticado sistema de **Tablero Kanban**, gestión de grupos y administración de usuarios, consolidando un ERP completo de tickets protegido por roles.

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Versión | Descripción |
|---|---|---|
| **Angular** | 21.1.x | Framework principal de desarrollo frontend |
| **Supabase (JS)** | 2.x | Backend-as-a-Service (Auth + PostgreSQL) |
| **TypeScript** | ~5.9.2 | Lenguaje de programación tipado |
| **PrimeNG** | 21.1.1 | Librería de componentes UI para Angular |
| **PrimeIcons** | 7.0.0 | Set de íconos complementario de PrimeNG |
| **@primeuix/themes (Aura + Teal)** | 21.0.4 | Tema visual Aura personalizado con paleta Teal |
| **Angular Signals** | 21.1.x | Estado reactivo de Angular en toda la app |

---

# Práctica 1 – Configuración Inicial del Proyecto

## 📋 Descripción
En esta primera práctica se generó el proyecto base con **Angular CLI**, se instaló y configuró **PrimeNG 21** con el tema **Aura**, y se verificó que el entorno de desarrollo funcionara correctamente mediante un componente de prueba.

## 🎯 Objetivos
1. Generar un nuevo proyecto Angular 21 utilizando Angular CLI.
2. Instalar y configurar la librería de componentes PrimeNG con el tema Aura.
3. Verificar el correcto funcionamiento del entorno.

---

# Práctica 2 – Sistema de Autenticación

## 📋 Descripción
Se extendió el proyecto base para implementar una SPA con sistema de autenticación compuesto por **Login**, **Registro** y una **Landing Page**. La interfaz utiliza componentes de PrimeNG.

## 🎯 Objetivos
1. Implementar un sistema de enrutamiento con múltiples páginas.
2. Crear formularios de Login y Registro con componentes de PrimeNG.
3. Utilizar Float Labels, binding bidireccional y estilos globales con la fuente Inter.

---

# Práctica 3 – Validación de Credenciales y Formulario de Registro

## 📋 Descripción
Se implementó la validación de credenciales en el **Login** (hardcodeadas) y se reconstruyó el formulario de **Registro** con validaciones exhaustivas utilizando **ReactiveFormsModule**, PrimeNG y validadores cruzados.

## 🎯 Objetivos
1. Validar login desde la interfaz temporalmente con datos hardcodeados.
2. Validar todos los campos del formulario de registro (sin vacíos).
3. Contraseña segura (mayúscula, minúscula, número y símbolo).
4. Restricción de mayoría de edad y validación telefónica estricta.

---

# Práctica 4 – Layout con Sidebar, Página Home y Personalización

## 📋 Descripción
Se implementó la estructura de layout (**MainLayout**) que integra un **Sidebar**, una página **Home**, y se personalizó el tema visual de PrimeNG con la paleta de colores **Teal**.

## 🎯 Objetivos
1. Crear una estructura de layout con Sidebar como menú de navegación.
2. Redirigir al Home después del login exitoso.
3. Personalizar el tema de PrimeNG con la paleta Teal (`definePreset`).
4. Aplicar variante "On Label" en los Float Labels.

---

# Práctica 5 – Sub-rutas, Páginas de Gestión y Migración Completa

## 📋 Descripción
Se agregaron 5 nuevas sub-rutas, un sidebar tipo árbol (tree) con secciones expandibles, y se realizó una migración estructurada usando cien por ciento componentes de PrimeNG. 

---

# Práctica 7 – Refactorización y Preparación del Entorno

## 📋 Descripción
Limpieza exhaustiva de la aplicación, eliminando secciones redundantes para preparar la base hacia un sistema robusto preparado para la inyección de JWT y Roles de Acceso.

---

# Práctica 8 – Control de Acceso Basado en Roles/Permisos (RBAC) simulado

## 📋 Descripción
Se implementó la lógica principal de un sistema RBAC (Role-Based Access Control) puramente en el Frontend. Se creó el `PermissionsService` basado en **Signals**, una **directiva estructural** `*ifHasPermission` y simuladores de JWT en el login, todo protegiendo los componentes visuales e inyectando "guards" de Angular.

---

# Prácticas 9 y 10 – Migración a Supabase y Sistema Kanban Integrado

## 📋 Descripción

En estas prácticas culminantes, el proyecto abandonó los datos simulados temporales para integrarse completamente con una base de datos y un sistema de autenticación en la nube usando **Supabase**. Se implementó un flujo completo de gestión de **Tickets a través de un tablero Kanban** interactivo y un potente panel de administración para controlar usuarios, permisos de grupos y asignaciones de puestos en tiempo real. 

El sistema ya no depende de mocks: todo, desde el renderizado de la UI hasta las reglas de protección, es conducido por las tablas de base de datos relacionales, manejando asincronía estrictamente con Angular Signals y promesas para evitar *race-conditions*.

## 🎯 Objetivos

1. Reemplazar la simulación de JWT introduciendo el módulo de autenticación asíncrona oficial de **Supabase Auth**.
2. Diseñar e integrar un modelo de base de datos relacional (tablas: `users`, `groups`, `permissions`, `tickets`).
3. Construir una página de **Grupos de Tickets** que informe gráficamente mediante progreso el estatus actual de todas las tareas.
4. Construir un **Kanban Board** funcional interactivo (Drag & Drop) enlazado al backend y asignaciones reales.
5. Rehacer el Panel de **Gestión de Usuarios** ofreciendo un CRUD rico con edición de Identidades, Puestos y Asignación de Roles.
6. Reflejar a la perfección las normativas RBAC desde los datos extraídos en real-time al Signal general.

## 🛠️ Novedades Implementadas (Práctica 10)

### Integración de Backend-as-a-Service (Supabase)
- Creación de `SupabaseService` centralizando la conexión cliente segura con la API local/nube.
- Refactorización de **`AuthService.ts`**:
  - `hydrateUser()`: consulta a Supabase Auth y a la tabla pública `users` + `permissions` en cadena para armar el Signal.
  - CRUD básico de usuarios implementado: `getUsers`, `updateUser` para poder alterar columnas como `group_id` y `puesto` remotamente.

### Pantalla de Gestión de Grupos (`/home/groups`)
- Componente `GroupsList` que hace un *fetch* paralelo de grupos y tickets, armando un resumen dinámico.
- Interfaz gráfica moderna con componentes visuales: barra de carga de "Completado" (`completionRate`), pills coloreadas de distribución (Pendientes, En Progreso, etc).
- Generación dinámica del enlace de ruteo hacia el Kanban particular del grupo (`/home/groups/:groupId`).

### Tablero Kanban Colaborativo (`/home/groups/:groupId`)
- Componente `GroupTickets` reescrito con `TicketService` real (`insert`, `update`, `delete`, `select` de `public.tickets`).
- Manejo asíncrono con **Optimistic Updates**: Cuando el usuario arrastra un ticket hacia una nueva columna, primero cambia en la Interfaz UI reactiva, luego verifica un commit a la Base de Datos.
- Interfaz adaptativa: Funcional de forma modal tanto con la vista Kanban arrastrable, como con una Tabla "Vista Lista".
- Edición dinámica de datos como Título, Asignado a (relacionado con los UUID's correctos en DB), Status, Prioridad, etc.
- Permisos granulares aplicados (*Directiva* `*appHasPermission('ticket:delete')`).

### Refactor del Panel Admin de Usuarios (`/home/admin-users`)
- Panel de gestión avanzado con un buscador inteligente re-dibujando la Grid de usuarios `filteredUsers()`.
- Columna nueva implementada y mapeada: **Puesto**.
- Diálogo estructurado y limpio para editar a un usuario, poder designar su puesto interno y además **seleccionar a qué grupo va a pertenecer**.
- Mapeado visual instantáneo: En cuanto al admin se le selecciona un grupo, viaja asíncronamente a Supabase para cargar todos los permisos nativos de ese Rol y se dibujan visualmente en una tabla del modal para entender "qué podrá hacer el empleado".

### Control de Estados con Angular Signals y Eliminación de Race Conditions
- Se solucionaron discrepancias de tiempo de respuesta (403 errors cruzados) al hacer *polling* del usuario. Las paginaciones que exigen consultas a Supabase como el Dashboard esperan primero reactivamente a que la hidratación central de `hydrateUser()` de finalice, inyectando confiabilidad al acceso RBAC a través de la red.

---

### Refactorización de Arquitectura y API Gateway (Post-Práctica 10)
- **`ApiGatewayService`**: Creación de una capa lógica (middleware) en el frontend que intercepta todas las peticiones a Supabase. Valida sesión y permisos granulares antes de ejecutar una consulta y envuelve las respuestas en el patrón estándar `ApiResponse` (incluyendo códigos de operación internos `intOpCode`).
- **`PermissionService`**: Extracción y centralización de la lógica RBAC (Role-Based Access Control) a un servicio dedicado y reactivo.
- **`TicketService`**: Servicio para desacoplar las interacciones con `public.tickets` usando el `ApiGatewayService`.
- **Nuevos Documentos de Contexto**: Se crearon los archivos `context_summary.md` y `audit_report.md` para proveer contexto arquitectónico claro a futuras implementaciones de IA.

---

## 🚀 Cómo Ejecutar el Proyecto Final

### Prerrequisitos
- **Node.js** (versión compatible con Angular 21)
- Instancia activa de **Supabase** (credenciales configurables localmente) con los scripts SQL provistos para creación de tablas/columnas e.g., `puesto`.

### Instalación
```bash
npm install
```

### Servidor de desarrollo
```bash
ng serve
```
Abre tu navegador en `http://localhost:4200/`. La aplicación se recarga automáticamente.

### Build de producción
```bash
ng build
```
Los artefactos de compilación se guardan en el directorio `dist/`.
