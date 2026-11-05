@echo off
title Setup Auto-Start VisMed ECG Forwarder
color 0b
cls

echo ===================================================
echo     Setup Auto-Start VisMed ECG Forwarder
echo ===================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_PATH=%SCRIPT_DIR%run_forwarder_hidden.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_NAME=%STARTUP_DIR%\VisMed_ECG_Forwarder.lnk

echo 1. Memeriksa file script...
if not exist "%VBS_PATH%" (
    echo [ERROR] File run_forwarder_hidden.vbs tidak ditemukan di folder ini!
    pause
    exit /b
)

echo 2. Mendaftarkan shortcut ke Windows Startup folder...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_NAME%'); $s.TargetPath = '%VBS_PATH%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

if %errorlevel% equ 0 (
    echo.
    echo ===================================================
    echo [SUKSES] Forwarder berhasil didaftarkan ke Startup!
    echo Script akan otomatis berjalan di background (tanpa
    echo jendela CMD) setiap kali komputer dinyalakan/login.
    echo ===================================================
) else (
    echo [ERROR] Gagal membuat shortcut di folder Startup.
)

echo.
pause
