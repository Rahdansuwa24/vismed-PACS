@echo off
title VisMed ECG Forwarder Gateway
color 0a
cls

echo ===================================================
echo             VisMed ECG Forwarder Gateway           
echo ===================================================
echo.
echo Memeriksa konfigurasi di file .env...
echo.

cd /d "%~dp0"

if not exist .env (
    echo [ERROR] File .env tidak ditemukan! 
    echo Harap buat file .env terlebih dahulu di folder ini.
    pause
    exit /b
)

echo Menjalankan script pemantau...
echo.
.\venv\Scripts\python.exe forwarder.py

echo.
echo Pemantauan terhenti atau mengalami error.
pause
