@echo off
title SGF v4.0 - Abrir Cliente
cd /d "%~dp0"

echo [INFO] En modo anti-ESET el cliente ya viene compilado.
echo [INFO] Debe iniciar primero el servidor con: start-servidor.bat
echo [INFO] Luego abra en el navegador: http://localhost:3000
echo.
start "SGF Cliente" http://localhost:3000
pause
