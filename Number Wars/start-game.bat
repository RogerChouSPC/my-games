@echo off
title Number Wars Launcher
cd /d "%~dp0"

echo ============================================================
echo   NUMBER WARS - starting up
echo ============================================================
echo.

echo 1) Closing any old game server / share link still running...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1

echo 2) Building the latest version (the first run after changes can take ~30s)...
call npm run build
if errorlevel 1 (
  echo.
  echo    ******  BUILD FAILED - the game cannot start.  ******
  echo    Copy the red text above and send it to Claude.
  echo.
  pause
  exit /b 1
)

echo 3) Starting the game server in a separate window...
start "Number Wars Server" cmd /k "npm run start"

echo 4) Creating your PUBLIC share link...
echo    (The launcher waits for the server, then makes a link and CHECKS it works.)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0share-link.ps1"

echo.
echo (Sharing has stopped.) You can close this window now.
pause
