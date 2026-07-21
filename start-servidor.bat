@echo off
title SGF v4.0 - Servidor Central
cd /d "%~dp0"

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

cd /d "%~dp0server"

if not exist "dist\index.js" (
    echo [ERROR] Falta server\dist\index.js. El backend no esta compilado.
    echo   Ejecute primero: instalar-todo.bat
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [!] Falta server\node_modules. Intentando recuperar...
    if exist "..\sgf-server-modules.zip" (
        echo   Extrayendo sgf-server-modules.zip...
        powershell -NoProfile -ExecutionPolicy Bypass -File "..\extraer-node-modules.ps1" -ZipPath "..\sgf-server-modules.zip" -Destino ".." 2>nul
    ) else (
        echo   Descargando sgf-server-modules.zip desde GitHub Releases...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://github.com/Junmoxia41/SGF/releases/download/v4.0.0/sgf-server-modules.zip' -OutFile '..\sgf-server-modules.zip' -UseBasicParsing -TimeoutSec 120 } catch { Write-Host 'No se pudo descargar. Ejecute instalar-todo.bat.'; exit 1 }" >nul
        if exist "..\sgf-server-modules.zip" (
            powershell -NoProfile -ExecutionPolicy Bypass -File "..\extraer-node-modules.ps1" -ZipPath "..\sgf-server-modules.zip" -Destino ".." 2>nul
        )
    )
    if not exist "node_modules" (
        echo [ERROR] No se pudieron obtener las dependencias.
        echo   Ejecute instalar-todo.bat y siga las instrucciones.
        pause
        exit /b 1
    )
    echo   [OK] node_modules recuperado.
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
