@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Instalar Todo
color 0A

cd /d "%~dp0"

echo ============================================================
echo   SGF v4.0 - Instalador de Dependencias
echo ============================================================
echo.
echo MODO ANTI-ESET:
echo - El cliente YA VIENE COMPILADO en client\dist (no requiere build)
echo - El backend se compila con tsc al instalar (sin binarios nativos)
echo - Solo se instalan dependencias necesarias para ejecutar
echo.

if not exist "server\package.json" (
    echo [ERROR] No se encontro server\package.json
    pause
    exit /b 1
)

if not exist "client\dist\index.html" (
    echo [ERROR] Falta client\dist\index.html
    echo Esta copia del proyecto no trae el frontend compilado.
    echo Si tiene los .zip de node_modules, use el modo OFFLINE.
    pause
    exit /b 1
)

where node >nul 2>&1 || (
    echo [ERROR] Node.js no instalado.
    echo Instale Node.js 18+ primero.
    pause
    exit /b 1
)

:: ============================================================
:: 1. Dependencias del servidor
:: ============================================================
echo [1/3] Instalando dependencias del servidor...
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

:: ============================================================
:: 2. Compilar backend si no hay dist/
:: ============================================================
echo.
echo [2/3] Verificando compilacion del backend...
if not exist "dist\index.js" (
    echo   [!] No existe dist\index.js. Instalando devDependencies para compilar...
    call npm install --no-audit --no-fund typescript@^5.9.0
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] No se pudo instalar typescript para compilar.
        echo Reinstale con internet disponible o use el paquete offline.
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    echo   [~] Compilando con tsc...
    call npx --no-install tsc
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] La compilacion del backend fallo.
        cd /d "%~dp0"
        pause
        exit /b 1
    )
    if exist "dist\index.js" (
        echo   [OK] Backend compilado.
    ) else (
        echo [ERROR] La compilacion no produjo dist\index.js
        cd /d "%~dp0"
        pause
        exit /b 1
    )
) else (
    echo   [OK] dist\index.js ya existe. No requiere compilacion.
)

:: ============================================================
:: 3. Verificar frontend precompilado
:: ============================================================
echo.
echo [3/3] Cliente compilado verificado.
cd /d "%~dp0"

echo.
echo ============================================================
echo   RESULTADO FINAL
echo ============================================================
echo.
echo   [OK] Servidor listo (dependencias + backend compilado)

echo   [OK] Cliente compilado listo

echo.
echo Para iniciar:
echo   1. Ejecuta: start-servidor.bat

echo   2. Abre: http://localhost:3000

echo.
pause
endlocal
exit /b 0
