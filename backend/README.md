# SIPNG Backend - Arquitectura de Microservicios

Este directorio contiene el núcleo lógico de SIPNG, implementado con **Fastify** para máxima velocidad y **PostgreSQL** para persistencia robusta.

## 🏛️ Componentes

| Nombre | Puerto | Descripción |
|--------|--------|-------------|
| **API Gateway** | 3000 | Orquestador central y proxy inverso. Métrica y Auth. |
| **Tickets Service** | 3001 | Gestión de la tabla `tickets` y auditoría de tickets. |
| **Groups Service** | 3002 | Gestión de la tabla `groups` y auditoría de grupos. |
| **Users Service** | 3003 | Gestión de la tabla `users` y auditoría de usuarios. |

## 🛠️ Tecnologías

- **Fastify**: Framework de servidor de alto rendimiento.
- **pg (node-postgres)**: Cliente PostgreSQL para consultas SQL nativas.
- **@fastify/reply-from**: Motor de proxy para la orquestación.
- **@supabase/supabase-js**: Para integración con Auth y fallback.

## 🔐 Estrategia de Identidad

El Gateway utiliza un sistema de **"Inyección de Cabeceras"**:
1. El Gateway recibe un JWT.
2. Descodifica el ID del usuario (`sub`).
3. Agrega la cabecera `X-User-Id` a la petición proxied.
4. Los microservicios simplemente leen esta cabecera para sus registros de auditoría.

---

## 🚀 Despliegue Backend

Se recomienda desplegar en su propio contenedor (ej. Railway) asegurando que las variables de entorno apunten a los puertos correctos de los microservicios.
