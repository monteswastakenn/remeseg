#!/bin/bash

echo "⚙️ Configurando entorno SIPNG..."

# Copiar .env de ejemplo si existe
if [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "✅ backend/.env creado desde .env.example"
else
    echo "⚠️ backend/.env.example no encontrado. Creando placeholder..."
    touch backend/.env
fi

echo "✅ Configuración de archivos completada."
