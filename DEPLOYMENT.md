# Guía de Deployment: SIPNG ERP

Este documento detalla los pasos para desplegar el ecosistema completo de SIPNG en producción utilizando **Railway** para el backend y **Vercel** para el frontend.

---

## 1. Preparación de Base de Datos (Supabase)

SIPNG utiliza PostgreSQL a través de Supabase. Asegúrate de tener:
- Una instancia activa de Supabase.
- La `DATABASE_URL` para conexión directa (Postgres Port 5432).
- `SUPABASE_URL` y `SUPABASE_KEY` del panel de API.

---

## 2. Deployment en Railway (Backend)

Railway orquestará el API Gateway y los microservicios.

### Paso 1: Configurar el Repositorio
1. Conecta tu repositorio en [Railway](https://railway.app).
2. Agrega el servicio apuntando a la carpeta `/backend`.

### Paso 2: Variables de Entorno en Railway
Configura las siguientes variables en el servicio de Railway:
- `DATABASE_URL`: Tu cadena de conexión de Postgres.
- `SUPABASE_URL`: Tu URL de Supabase.
- `SUPABASE_KEY`: Tu Key anónima de Supabase.
- `FRONTEND_URL`: URL final de tu frontend en Vercel.
- `PORT`: 3000 (Railway inyecta esto automáticamente).

### Paso 3: Puertos de Microservicios
En producción, el Gateway se comunica con los microservicios internamente o mediante URLs públicas. Si despliegas todo en un solo contenedor Railway:
- `TICKETS_SERVICE_URL`: `http://localhost:3001`
- `GROUPS_SERVICE_URL`: `http://localhost:3002`
- `USERS_SERVICE_URL`: `http://localhost:3003`

---

## 3. Deployment en Vercel (Frontend)

Vercel es ideal para aplicaciones Angular.

### Paso 1: Configuración de Build
1. Importa el repositorio en [Vercel](https://vercel.com).
2. **Framework Preset**: Angular.
3. **Build Command**: `npm run build`.
4. **Output Directory**: `dist/practica9-1/browser` (Verifica tu `angular.json`).

### Paso 2: Variables de Entorno en Vercel
- Ninguna requerida por defecto, ya que la URL del backend se configura en el `environment.prod.ts`.

---

## 4. Verificación de Producción

Una vez desplegada, puedes verificar el estado de los servicios:
- **Health Check**: `https://tu-api.up.railway.app/health`
- **Frontend**: `https://tu-app.vercel.app`

---

> [!TIP]
> **CORS**: Asegúrate de que la variable `FRONTEND_URL` en Railway coincida exactamente con la URL que te asigne Vercel, de lo contrario las peticiones serán bloqueadas.
