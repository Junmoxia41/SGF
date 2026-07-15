@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Instalador
color 0A

:: Este script pausa al final SIEMPRE para que la ventana no se
:: cierre si hay un error. Tambien se pausa en cada error.

cd /d "%~dp0"

echo ============================================================
echo   SGF v4.0 - Instalador
echo ============================================================
echo.
echo   1. Verifica Node.js
echo   2. Instala dependencias (npm install)
echo   3. Compila el backend (tsc)
echo   4. Compila el frontend (vite build)
echo.
echo   Requiere internet SOLO la primera vez.
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js NO esta instalado o NO esta en el PATH.
    echo.
    echo   Solucion:
    echo     1. Instale Node.js 18 o superior: https://nodejs.org
    echo     2. Marque la opcion "Add to PATH" durante la instalacion
    echo     3. Cierre y vuelva a abrir esta ventana
    echo     4. Vuelva a ejecutar este script
    echo.
    echo ============================================================
    echo   PRESIONE UNA TECLA PARA CERRAR
    echo ============================================================
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo [OK] Node.js detectado: %NODE_VER%
echo.

:: ============================================================
:: 1. Backend - npm install
:: ============================================================
echo [1/4] Instalando dependencias del BACKEND...
cd /d "%~dp0server"
if not exist "package.json" (
    echo.
    echo [ERROR] No se encontro server\package.json
    echo La carpeta del proyecto esta incompleta.
    pause & exit /b 1
)
if exist "node_modules" (
    echo   [!] server\node_modules ya existe. Omitiendo npm install.
) else (
    echo   Esto puede tardar 1-3 minutos...
    call npm install --no-audit --no-fund --loglevel=error
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Fallo npm install en el backend.
        echo.
        echo   Posibles causas:
        echo     - Sin internet
        echo     - Proxy no configurado (intente: npm config set proxy http://proxy:puerto)
        echo     - Firewall corporativo bloqueando npm
        echo.
        echo   Si esta en una PC sin internet, copie los node_modules
        echo   desde una PC con internet (ver empaquetar-portable.bat).
        echo.
        pause & exit /b 1
    )
    echo   [OK] server\node_modules instalado.
)
echo.

:: ============================================================
:: 2. Backend - tsc
:: ============================================================
echo [2/4] Compilando el BACKEND (tsc)...
call npx --no-install tsc
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La compilacion del backend fallo.
    echo.
    echo   Para ver el error completo, abra una terminal en esta
    echo   carpeta y ejecute:
    echo     cd server
    echo     npx tsc
    echo.
    pause & exit /b 1
)
if not exist "dist\index.js" (
    echo [ERROR] tsc no produjo dist\index.js
    pause & exit /b 1
)
echo   [OK] server\dist\index.js generado.
echo.

:: ============================================================
:: 3. Frontend - npm install
:: ============================================================
echo [3/4] Instalando dependencias del FRONTEND...
cd /d "%~dp0client"
if not exist "package.json" (
    echo.
    echo [ERROR] No se encontro client\package.json
    pause & exit /b 1
)
if exist "node_modules" (
    echo   [!] client\node_modules ya existe. Omitiendo npm install.
) else (
    echo   Esto puede tardar 1-3 minutos...
    call npm install --no-audit --no-fund --loglevel=error
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Fallo npm install en el frontend.
        pause & exit /b 1
    )
    echo   [OK] client\node_modules instalado.
)
echo.

:: ============================================================
:: 4. Frontend - vite build
:: ============================================================
echo [4/4] Compilando el FRONTEND (vite build)...
call npx --no-install vite build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La compilacion del frontend fallo.
    echo.
    echo   Para ver el error completo:
    echo     cd client
    echo     npx vite build
    echo.
    pause & exit /b 1
)
if not exist "dist\index.html" (
    echo [ERROR] vite build no produjo dist\index.html
    pause & exit /b 1
)
echo   [OK] client\dist\index.html generado.
echo.

cd /d "%~dp0"

echo ============================================================
echo   INSTALACION COMPLETA
echo ============================================================
echo.
echo   [OK] Backend compilado   = server\dist
echo   [OK] Frontend compilado  = client\dist
echo   [OK] Dependencias        = server\node_modules
echo                              client\node_modules
echo.
echo   Para iniciar el servidor:
echo     start-servidor.bat
echo     (luego abre http://localhost:3000)
echo.
echo ============================================================
echo   PRESIONE UNA TECLA PARA CERRAR
echo ============================================================
pause
endlocal
exit /b 0
