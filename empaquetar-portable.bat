@echo off
setlocal enabledelayedexpansion
title SGF v4.0 - Empaquetar Portable (Offline)
color 0E

cd /d "%~dp0"

echo ============================================================
echo   SGF v4.0 - EMPAQUETAR PARA OFFLINE
echo ============================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no instalado.
    pause & exit /b 1
)

call :fix_npm_proxy

:: ============================================================
:: 1. SERVER - npm install
:: ============================================================
echo [1/6] Instalando dependencias del SERVIDOR...
echo.
cd /d "%~dp0server"
call npm install --legacy-peer-deps 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo npm install en server\
    cd /d "%~dp0"
    pause & exit /b 1
)
echo   [OK] server/node_modules listo.
cd /d "%~dp0"

:: ============================================================
:: 2. CLIENT - npm install (con maximo detalle si falla)
:: ============================================================
echo.
echo [2/6] Instalando dependencias del CLIENTE...
echo   Esto puede tardar varios minutos. Espere...
echo.
cd /d "%~dp0client"

call npm install --legacy-peer-deps
if %errorlevel% equ 0 goto :client_ok

echo.
echo   [!] Primer intento fallo. Reintentando con --force...
call npm install --legacy-peer-deps --force
if %errorlevel% equ 0 goto :client_ok

echo.
echo   [!] Segundo intento fallo. Probando sin package-lock...
if exist "package-lock.json" del "package-lock.json"
if exist "node_modules" rmdir /s /q "node_modules"
call npm install --legacy-peer-deps --prefer-offline
if %errorlevel% equ 0 goto :client_ok

echo.
echo   [ERROR] Todos los intentos fallaron.
echo.
echo   Posibles causas:
echo     1. Sin internet o proxy bloqueando
if not "!PROXY_NOTICE!"=="" echo     1.1 Revise el proxy corregido automaticamente: !PROXY_NOTICE!
echo     2. Version de Node.js muy nueva/antigua
echo     3. Paquete pdfjs-dist requiere compilacion nativa
echo.
echo   Intente manualmente en esta carpeta:
echo     cd client
echo     npm install --legacy-peer-deps
echo.
echo   Y revise el error especifico que aparece.
cd /d "%~dp0"
pause & exit /b 1

:client_ok
echo   [OK] client/node_modules listo.
cd /d "%~dp0"

:: ============================================================
:: 3. Comprimir server
:: ============================================================
echo.
echo [3/6] Comprimiendo server\node_modules...
if exist "sgf-server-modules.zip" del "sgf-server-modules.zip"
call :zip_silent "server\node_modules\*" "sgf-server-modules.zip"
if %errorlevel% neq 0 (
    echo   [ERROR] No se pudo crear sgf-server-modules.zip
    pause & exit /b 1
)
if exist "sgf-server-modules.zip" (
    for %%A in ("sgf-server-modules.zip") do echo   [OK] sgf-server-modules.zip (%%~zA bytes)
) else (
    echo   [ERROR] No se pudo crear el .zip
)

:: ============================================================
:: 4. Comprimir client
:: ============================================================
echo.
echo [4/6] Comprimiendo client\node_modules...
if exist "sgf-client-modules.zip" del "sgf-client-modules.zip"
call :zip_silent "client\node_modules\*" "sgf-client-modules.zip"
if %errorlevel% neq 0 (
    echo   [ERROR] No se pudo crear sgf-client-modules.zip
    pause & exit /b 1
)
if exist "sgf-client-modules.zip" (
    for %%A in ("sgf-client-modules.zip") do echo   [OK] sgf-client-modules.zip (%%~zA bytes)
) else (
    echo   [ERROR] No se pudo crear el .zip
)

:: ============================================================
:: 5. ZIP completo
:: ============================================================
echo.
echo [5/6] Creando empaquetado completo del proyecto...
if exist "sgf-proyecto-completo.zip" del "sgf-proyecto-completo.zip"
call :zip_silent "server','client','launcher','SGF-Panel.bat','start-servidor.bat','start-cliente.bat','instalar-todo.bat','*.txt','*.md" "sgf-proyecto-completo.zip" 1
if %errorlevel% neq 0 (
    echo   [ERROR] No se pudo crear sgf-proyecto-completo.zip
    pause & exit /b 1
)
if exist "sgf-proyecto-completo.zip" (
    for %%A in ("sgf-proyecto-completo.zip") do echo   [OK] sgf-proyecto-completo.zip (%%~zA bytes)
)

echo.
echo [6/6] Listo.
echo.
echo ============================================================
echo   EMPAQUETADO COMPLETO
echo ============================================================
echo.
echo   Archivos generados en la raiz:
echo     sgf-server-modules.zip    - node_modules del servidor
echo     sgf-client-modules.zip    - node_modules del cliente
echo     sgf-proyecto-completo.zip - Todo el proyecto
echo.
echo   PARA USAR EN PC SIN INTERNET:
echo   1. Copia TODA la carpeta sgf-refactor al USB
echo      (incluye los 3 .zip + node-v*.msi si tienes)
echo   2. En la otra PC, pega la carpeta
echo   3. Ejecuta: instalar-todo.bat
echo      (extrae los .zip automaticamente)
echo   4. Ejecuta: SGF-Panel.bat
echo.
pause
endlocal
exit /b 0

:fix_npm_proxy
set "PROXY_NOTICE="
call :fix_one_proxy proxy
call :fix_one_proxy https-proxy
exit /b 0

:fix_one_proxy
set "CFG_NAME=%~1"
set "CFG_VALUE="
for /f "usebackq delims=" %%P in (`npm config get %CFG_NAME% 2^>nul`) do set "CFG_VALUE=%%P"
if /i "!CFG_VALUE!"=="null" exit /b 0
if "!CFG_VALUE!"=="" exit /b 0
echo(!CFG_VALUE!| findstr /b /i /c:"http://" /c:"https://" >nul
if not errorlevel 1 exit /b 0
set "FIXED_PROXY=http://!CFG_VALUE!"
echo [WARN] %CFG_NAME% invalido detectado: !CFG_VALUE!
echo [INFO] Corrigiendo automaticamente a: !FIXED_PROXY!
call npm config set %CFG_NAME% "!FIXED_PROXY!" >nul 2>&1
set "PROXY_NOTICE=!FIXED_PROXY!"
exit /b 0

:zip_silent
set "ZIP_SOURCE=%~1"
set "ZIP_DEST=%~2"
set "ZIP_MULTI=%~3"
if "%ZIP_MULTI%"=="1" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Compress-Archive -Path 'server','client','launcher','SGF-Panel.bat','start-servidor.bat','start-cliente.bat','instalar-todo.bat','*.txt','*.md' -DestinationPath '%ZIP_DEST%' -Force" >nul
    exit /b %errorlevel%
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Compress-Archive -Path '%ZIP_SOURCE%' -DestinationPath '%ZIP_DEST%' -Force" >nul
exit /b %errorlevel%
