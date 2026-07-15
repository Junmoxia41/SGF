@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Instalador
color 0A

cd /d "%~dp0"

echo ============================================================
echo   SGF v4.0 - Instalador
echo ============================================================
echo.
echo Este instalador:
echo   1. Verifica Node.js
echo   2. Instala dependencias del backend (npm install)
echo   3. Instala dependencias del frontend (npm install)
echo   4. Compila el backend (tsc)
echo   5. Compila el frontend (vite build)
echo.
echo Requiere internet SOLO la primera vez.
echo Despues de instalado, el servidor se puede llevar a PCs
echo sin internet (ver empaquetar-portable.bat).
echo.

where node >nul 2>&1 || (
    echo [ERROR] Node.js no instalado.
    echo Descarguelo de https://nodejs.org (version 18 o superior).
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo [INFO] Node.js detectado: %NODE_VER%
echo.

:: ============================================================
:: Backend
:: ============================================================
echo [1/4] Instalando dependencias del BACKEND...
cd /d "%~dp0server"
if not exist "package.json" (
    echo [ERROR] No se encontro server\package.json
    pause & exit /b 1
)
if exist "node_modules" (
    echo   [!] server\node_modules ya existe. Omitiendo npm install.
) else (
    call npm install --no-audit --no-fund --loglevel=error 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Fallo npm install en el backend.
        echo Revise su conexion a internet o la configuracion de proxy.
        echo   npm config get proxy
        echo   npm config set proxy http://su-proxy:puerto
        pause & exit /b 1
    )
    echo   [OK] server\node_modules listo.
)
echo.

:: ============================================================
:: Compilar backend
:: ============================================================
echo [2/4] Compilando el backend (tsc)...
call npx --no-install tsc
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La compilacion del backend fallo.
    echo   cd server
    echo   npx tsc
    pause & exit /b 1
)
if not exist "dist\index.js" (
    echo [ERROR] La compilacion no produjo dist\index.js
    pause & exit /b 1
)
echo   [OK] dist\index.js generado.
echo.

:: ============================================================
:: Frontend
:: ============================================================
cd /d "%~dp0client"
if not exist "package.json" (
    echo [ERROR] No se encontro client\package.json
    pause & exit /b 1
)
echo [3/4] Instalando dependencias del FRONTEND...
if exist "node_modules" (
    echo   [!] client\node_modules ya existe. Omitiendo npm install.
) else (
    call npm install --no-audit --no-fund --loglevel=error 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Fallo npm install en el frontend.
        echo Revise su conexion a internet o la configuracion de proxy.
        pause & exit /b 1
    )
    echo   [OK] client\node_modules listo.
)
echo.

:: ============================================================
:: Compilar frontend
:: ============================================================
echo [4/4] Compilando el frontend (vite build)...
call npx --no-install vite build 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La compilacion del frontend fallo.
    echo   cd client
    echo   npx vite build
    pause & exit /b 1
)
if not exist "dist\index.html" (
    echo [ERROR] vite build no produjo dist\index.html
    pause & exit /b 1
)
echo   [OK] dist\index.html generado.
echo.

cd /d "%~dp0"

echo ============================================================
echo   INSTALACION COMPLETA
echo ============================================================
echo.
echo   [OK] Backend compilado    = server\dist
echo   [OK] Frontend compilado   = client\dist
echo   [OK] Dependencias         = server\node_modules + client\node_modules
echo.
echo Para iniciar el servidor:
echo   start-servidor.bat
echo   (luego abre http://localhost:3000 en el navegador)
echo.
echo Para empaquetar el sistema para una PC sin internet:
echo   empaquetar-portable.bat
echo.
pause
endlocal
exit /b 0
