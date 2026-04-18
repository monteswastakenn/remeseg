# Análisis Técnico: Frontend Angular

El frontend de SIPNG ha sido desarrollado con un enfoque en modernidad, seguridad y experiencia de usuario fluida, utilizando el ecosistema de **Angular 21** y **PrimeNG**.

## 🏗️ Arquitectura de Componentes

La aplicación sigue una arquitectura modular y escalable:
- **Core Layer**: Contiene los interceptores (Auth), guards y directivas centrales (RBAC).
- **Service Layer**: Servicios reactivos que consumen el API Gateway.
- **Shared Layer**: Componentes reutilizables basados en PrimeNG.
- **Feature Layer**: Páginas y módulos de negocio (Tickets, Kanban, Usuarios).

## 🎛️ Estado y Reactividad (Signals)

Hemos adoptado el uso de **Angular Signals** para la gestión de estado de grano fino, lo que permite:
- Rendimiento optimizado al disparar cambios solo donde es necesario.
- Sintaxis más limpia y declarativa.
- Integración nativa con la detección de cambios de Angular.

## 🔐 Seguridad y RBAC

El sistema de permisos se implementa en tres niveles:
1. **Directivas Personallizadas**: `*hasPermission` condiciona el renderizado de elementos en el DOM segúun las capacidades del usuario.
2. **Route Guards**: Bloquean el acceso a rutas no autorizadas.
3. **HTTP Interceptor**: Inyecta automáticamente el JWT en todas las peticiones al Gateway.

---

## 🎨 UI/UX con PrimeNG

Se han utilizado componentes avanzados de PrimeNG para garantizar una estética premium:
- `p-table` para gestión de datos masivos.
- `DragDropModule` para la experiencia del tablero Kanban.
- `p-dialog` y `p-toast` para interacción fluida.
- Temas modernos con soporte para personalización profunda.
