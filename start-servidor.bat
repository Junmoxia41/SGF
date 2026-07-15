@echo off
title SGF v4.0 - Servidor Central
cd /d "%~dp0server"

where node >nul 2>&1 || (
    echo [ERROR] Node.js no instalado.
    pause & exit /b 1
)

if not exist "dist\index.js" (
    echo [ERROR] Falta server\dist\index.js. El backend no esta compilado.
    echo Ejecute instalar-todo.bat primero.
    pause & exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Falta server\node_modules. Las dependencias no estan instaladas.
    echo Ejecute instalar-todo.bat primero.
    pause & exit /b 1
)

echo [OK] Iniciando servidor y cliente en http://localhost:3000
node dist\index.js
pause
