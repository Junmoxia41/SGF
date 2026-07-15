@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Instalador
color 0A

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
echo   Si su red tiene proxy, vea GUIA-PROXY.md antes de continuar.
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

if defined HTTP_PROXY (
    echo [OK] HTTP_PROXY configurado en esta consola
) else if defined HTTPS_PROXY (
    echo [OK] HTTPS_PROXY configurado en esta consola
) else (
    npm config get proxy >nul 2>&1
    for /f "delims=" %%p in ('npm config get proxy 2^>nul') do set "NPM_PROXY=%%p"
    if defined NPM_PROXY if not "!NPM_PROXY!"=="null" if not "!NPM_PROXY!"=="" (
        echo [OK] npm config proxy: !NPM_PROXY!
    ) else (
        echo [AVISO] No se detecto proxy configurado.
        echo         Si su red lo requiere, vea GUIA-PROXY.md.
    )
)
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
        echo   Si su red tiene proxy:
        echo     1. Vea GUIA-PROXY.md para configurarlo
        echo     2. Cierre esta ventana
        echo     3. Configure las variables HTTP_PROXY y HTTPS_PROXY
        echo     4. Vuelva a ejecutar este script
        echo.
        echo   Para ver el error exacto, ejecute manualmente:
        echo     cd server
        echo     npm install
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
    echo   Para ver el error completo:
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
        echo Vea GUIA-PROXY.md si su red requiere proxy.
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
