@echo off
chcp 65001 > nul
title Junta de Agua y Riego "La Jones" - Presentación

echo ============================================================
echo   Junta de Agua y Riego "La Jones" (Patate, Tungurahua)
echo   Iniciando entorno interactivo de presentación...
echo ============================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Node.js en el sistema.
    pause
    exit /b 1
)

start "" http://localhost:4200
node scripts/dev.js

pause
