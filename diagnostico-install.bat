@echo off
title SGF v4.0 - Diagnostico npm install
color 0B

cd /d "%~dp0"

echo ============================================================
echo   SGF - DIAGNOSTICO DE INSTALACION

echo ============================================================
echo.
echo Este script muestra el error EXACTO del servidor.
echo En modo anti-ESET NO se instala el client porque ya viene compilado.
echo.

where node >nul 2>&1 || (echo [ERROR] Node.js no instalado & pause & exit /b 1)

:: ============================================================
echo === PROBANDO SERVER (SOLO PRODUCCION) ===
echo.
cd /d "%~dp0server"
echo Directorio: %cd%
echo.
call npm install --omit=dev --no-audit --no-fund
echo.
echo Server: exit code = %errorlevel%
echo.

:: ============================================================
echo === VERIFICANDO CLIENTE COMPILADO ===
echo.
cd /d "%~dp0"
if exist "client\dist\index.html" (
    echo [OK] client\dist\index.html encontrado
    echo El cliente ya esta compilado y NO necesita npm install en esta PC.
) else (
    echo [ERROR] Falta client\dist\index.html
    echo Necesitas una copia del proyecto ya compilada.
)

echo.
echo Si ESET vuelve a bloquear archivos, revisa si detecta esbuild.exe.
echo En esta version anti-ESET ya no se usa npm install del cliente.
echo.
pause
