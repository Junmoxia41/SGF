@echo off
title SGF v4.0 - Servidor Central
cd /d "%~dp0server"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js NO esta instalado o NO esta en el PATH.
    echo Instale Node.js 18+ desde https://nodejs.org
    echo.
    echo ============================================================
    echo   PRESIONE UNA TECLA PARA CERRAR
    echo ============================================================
    pause
    exit /b 1
)

if not exist "dist\index.js" (
    echo [ERROR] Falta server\dist\index.js. El backend no esta compilado.
    echo.
    echo   Ejecute primero: instalar-todo.bat
    echo.
    echo ============================================================
    echo   PRESIONE UNA TECLA PARA CERRAR
    echo ============================================================
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Falta server\node_modules. Las dependencias no estan instaladas.
    echo.
    echo   Ejecute primero: instalar-todo.bat
    echo.
    echo ============================================================
    echo   PRESIONE UNA TECLA PARA CERRAR
    echo ============================================================
    pause
    exit /b 1
)

echo.
echo   ============================================================
echo     SGF v4.0 - Servidor Central
echo   ============================================================
echo.
echo   Iniciando en http://localhost:3000
echo   Para detener: Ctrl+C o cierre esta ventana
echo.
node dist\index.js
echo.
echo ============================================================
echo   El servidor se ha detenido.
echo   PRESIONE UNA TECLA PARA CERRAR
echo ============================================================
pause
