@echo off
title SGF v4.0 - Abrir Cliente
cd /d "%~dp0"

echo Iniciando servidor...
start "" /B cmd /c "cd /d %~dp0server && node dist\index.js"
timeout /t 2 /nobreak >nul

echo Abriendo navegador en http://localhost:3000
start "" "http://localhost:3000"
