@echo off
title SGF v4.0 - Servidor Central
cd /d "%~dp0server"

where node >nul 2>&1 || (echo [ERROR] Node.js no instalado. & pause & exit /b 1)

:: Si falta dist/ pero hay src/, intentar compilar
if not exist "dist\index.js" (
    if exist "src\index.ts" (
        echo [!] No se encontro dist\index.js. Compilando...
        if not exist "node_modules" (
            echo [!] Instalando dependencias del servidor...
            call npm install --omit=dev --no-audit --no-fund || (
                echo [ERROR] Fallo npm install del servidor.
                echo Si usa ESET, excluya la carpeta del proyecto o use el paquete offline.
                pause & exit /b 1
            )
        )
        if not exist "node_modules\.bin\tsc.cmd" (
            echo [ERROR] tsc no encontrado. Reinstale las dependencias.
            pause & exit /b 1
        )
        echo [~] Compilando...
        call npx --no-install tsc
        if %errorlevel% neq 0 (
            echo [ERROR] La compilacion fallo.
            pause & exit /b 1
        )
        if not exist "dist\index.js" (
            echo [ERROR] La compilacion no produjo dist\index.js
            pause & exit /b 1
        )
    ) else (
        echo [ERROR] Falta server\dist\index.js y server\src\index.ts.
        echo Este paquete no trae el codigo fuente del backend.
        pause & exit /b 1
    )
)

:: Instalar deps de produccion si hace falta
if not exist "node_modules" (
    echo [!] Instalando SOLO dependencias de produccion del servidor...
    call npm install --omit=dev --no-audit --no-fund || (
        echo [ERROR] Fallo npm install del servidor.
        echo Si usa ESET, excluya la carpeta del proyecto o use el paquete offline.
        pause & exit /b 1
    )
)

echo [OK] Iniciando servidor y cliente en http://localhost:3000
echo El frontend ya viene compilado y lo sirve el backend.
node dist\index.js
pause
