# Referencia Rápida de Comandos

Guía rápida para desarrolladores que mantienen el proyecto SIPNG.

## 🏃 Lanzamiento de Servicios

| Comando | Acción |
|---------|--------|
| `npm run dev` | Lanza todo el ecosistema (Recomendado) |
| `npm run dev:gateway` | Lanza solo el Gateway (Puerto 3000) |
| `npm run dev:tickets` | Lanza microservicio de Tickets (Puerto 3001) |
| `npm run dev:groups` | Lanza microservicio de Grupos (Puerto 3002) |
| `npm run dev:users` | Lanza microservicio de Usuarios (Puerto 3003) |
| `npm start` | Lanza solo el Frontend de Angular (Puerto 4200) |

## 📦 Gestión de Dependencias

- **Instalar todo**: `npm run install:all`
- **Frontend**: `npm install`
- **Backend (Gateway + Services)**: `cd backend && npm install`

## 🛠️ Herramientas Útiles (Manual)

### Probar Salud del Gateway
```bash
curl http://localhost:3000/health
```

### Probar Registro de Usuarios (Proxy a Supabase)
```bash
curl -X POST http://localhost:3000/api/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

---

> [!TIP]
> **Logs**: Todos los microservicios están configurados con `pino` (vía Fastify). Puedes ver los logs detallados en la consola de cada proceso para depurar errores de SQL.
