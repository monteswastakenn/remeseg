# SIPNG ERP - Sistema Integral de Gestión de Tickets

🎯 **ERP moderno con arquitectura de microservicios para gestión de tickets en modo Kanban/Lista con permisos granulares por usuario y grupo.**

![Status](https://img.shields.io/badge/status-active%20development-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20%2B-green)
![Angular](https://img.shields.io/badge/angular-21-red)

---

## 🚀 Quick Start

```bash
# Clonar repositorio
git clone <repo-url>
cd practica10

# Instalar todas las dependencias
npm run install:all

# Configurar backend
cp backend/.env.example backend/.env # (Si existe)

# Ejecutar en desarrollo
npm run dev
```

Accede a:
- **Frontend:** http://localhost:4200
- **Backend (Gateway):** http://localhost:3000

---

## 📚 Documentación

- **[Guía de Deployment](./DEPLOYMENT.md)** - Railway + Vercel
- **[Análisis de Frontend](./FRONTEND_ANALYSIS.md)** - Arquitectura Angular
- **[Guía de Configuración Local](./SETUP_LOCAL.md)** - Paso a paso
- **[Resumen de Implementación](./IMPLEMENTATION_SUMMARY.md)** - Características técnicas
- **[Referencia Rápida](./QUICK_REFERENCE.md)** - Comandos y Tips

---

## 🔐 Credenciales de Prueba

| Email | Password | Rol Sugerido |
|-------|----------|--------------|
| `jesusefrainbocanegramata@gmail.com` | `password123` | Superadmin |
| `diegotristanlimon@gmail.com` | `password` | Admin |
| `luismontesvelazquez@gmail.com` | `password` | Usuario |
| `paulavaleriasancheztrejo@gmail.com` | `password` | Dev |

---

## ✨ Características

✅ Autenticación segura con JWT (Supabase Auth)  
✅ Permisos granulares sin roles rígidos  
✅ Gestión de tickets Kanban/Lista con PrimeNG  
✅ Microservicios independientes (Tickets, Grupos, Usuarios)  
✅ API Gateway como orquestador central  
✅ Registro de auditoría por microservicio  

---

## 📦 Stack

- **Angular 21** + PrimeNG (Frontend)
- **Fastify** + PostgreSQL (Backend)
- **Microservicios** (User, Tickets, Groups)
- **Supabase** (Database + Authentication)
- **Railway** (Backend Hosting)
- **Vercel** (Frontend Hosting)

---

[Ver documentación completa de despliegue →](./DEPLOYMENT.md)