@echo off
title SGF v4.0 - Servidor Central
cd /d "%~dp0server"

where node >nul 2>&1 || (echo [ERROR] Node.js no instalado. & pause & exit /b 1)

if not exist "dist\index.js" (
    echo [ERROR] Falta server\dist\index.js
    echo Este paquete debe venir ya compilado.
    pause & exit /b 1
)

if not exist "node_modules" (
    echo [!] Instalando SOLO dependencias de produccion del servidor...
    call npm install --omit=dev --no-audit --no-fund || (
        echo [ERROR] Fallo npm install del servidor.
        echo Si usa ESET, excluya la carpeta del proyecto o use el paquete offline.
        pause & exit /b 1
    )
)

echo [OK] Iniciando servidor y cliente en http://localhost:3000
echo El frontend ya viene compilado y lo sirve el backend.
node dist\index.js
pause
