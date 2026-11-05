@echo off
title VisMed ECG Forwarder Gateway
color 0a
cls

echo ===================================================
echo             VisMed ECG Forwarder Gateway           
echo ===================================================
echo.

cd /d "%~dp0"

if not exist .env (
    echo [ERROR] File .env tidak ditemukan! 
    echo Harap pastikan file .env sudah tersedia di folder ini.
    pause
    exit /b
)

echo Memulai pemantauan folder dan integrasi ECG...
echo.

if exist ".\venv\Scripts\python.exe" (
    .\venv\Scripts\python.exe forwarder.py
) else (
    python forwarder.py
)

echo.
echo Pemantauan terhenti atau mengalami error.
pause
