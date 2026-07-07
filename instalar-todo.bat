@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Instalar Todo (Modo anti-ESET)
color 0A

cd /d "%~dp0"

echo ============================================================
echo   SGF v4.0 - Instalador de Dependencias

echo ============================================================
echo.
echo MODO ANTI-ESET:
echo - El cliente ya viene compilado en client\dist
echo - Solo se instalan dependencias de PRODUCCION del servidor
echo.

if not exist "server\package.json" (
    echo [ERROR] No se encontro server\package.json
    pause
    exit /b 1
)

if not exist "client\dist\index.html" (
    echo [ERROR] Falta client\dist\index.html
    echo Esta copia del proyecto no trae el frontend compilado.
    pause
    exit /b 1
)

where node >nul 2>&1 || (
    echo [ERROR] Node.js no instalado.
    echo Instale Node.js 18+ primero.
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias del servidor...
cd /d "%~dp0server"
call npm install --omit=dev --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo npm install del servidor.
    echo Si usa ESET, excluya la carpeta del proyecto o use el modo OFFLINE.
    cd /d "%~dp0"
    pause
    exit /b 1
)

echo.
echo [2/2] Cliente compilado verificado.
cd /d "%~dp0"

echo.
echo ============================================================
echo   RESULTADO FINAL

echo ============================================================
echo.
echo   [OK] Servidor listo

echo   [OK] Cliente compilado listo

echo.
echo Para iniciar:
echo   1. Ejecuta: start-servidor.bat

echo   2. Abre: http://localhost:3000

echo.
pause
endlocal
exit /b 0
