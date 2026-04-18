# Guía de Configuración Local

Sigue estos pasos para poner en marcha el ecosistema SIPNG en tu máquina local.

## 📋 Requisitos Previos

- **Node.js**: Versión 20 o superior.
- **npm**: Versión 10 o superior.
- **Cuenta en Supabase**: Para la persistencia de datos.

## 🛠️ Instalación Paso a Paso

### 1. Clonar e Instalar
```bash
git clone <tu-url-de-github>
cd practica10
npm run install:all
```

### 2. Variables de Entorno
Crea un archivo `.env` en la carpeta `backend/` con el siguiente contenido:

```env
SUPABASE_URL=tu-url-de-supabase
SUPABASE_KEY=tu-anon-key-de-supabase
DATABASE_URL=postgresql://postgres:[password]@tu-host:5432/postgres
FRONTEND_URL=http://localhost:4200
```

### 3. Iniciar Servicios
La forma más fácil es usando el orquestador de la raíz:

```bash
npm run dev
```

Este comando iniciará:
1. **API Gateway** (Puerto 3000)
2. **Ticket Microservice** (Puerto 3001)
3. **Groups Microservice** (Puerto 3002)
4. **Users Microservice** (Puerto 3003)
5. **Angular UI** (Puerto 4200)

## 🧪 Pruebas de Conectividad

Para verificar que los microservicios están listos, puedes consultar el health check:
`http://localhost:3000/health`

---

> [!CAUTION]
> **Base de Datos**: Asegúrate de que tu base de datos en Supabase tenga las tablas `tickets`, `groups`, `users`, `audit_logs` y `api_metrics` creadas para que el sistema funcione correctamente. 
