#!/bin/bash

echo "📦 Instalando dependencias de SIPNG..."

# Root (Angular + Orchestrator)
echo "--- Instalando en el Root (Frontend) ---"
npm install

# Backend
echo "--- Instalando en Backend (Gateway + Services) ---"
cd backend
npm install

echo "✅ Instalación completada."
