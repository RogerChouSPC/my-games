@echo off
title Number Wars Launcher
cd /d "%~dp0"

echo ============================================================
echo   NUMBER WARS - starting up
echo ============================================================
echo.

echo 1) Closing any old game server still using port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

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

echo 4) Waiting a few seconds for it to be ready...
timeout /t 9 /nobreak >nul

echo 5) Opening the game in your browser...
start "" "http://localhost:3000"

echo.
echo 6) Creating your public link with Cloudflare...
echo.
echo    LOOK FOR A LINE LIKE:  https://something.trycloudflare.com
echo    That is the link you share with friends.
echo.
echo    Keep BOTH windows open while people play.
echo    To stop sharing: close both windows.
echo ============================================================
echo.

set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CF%" set "CF=C:\Program Files\cloudflared\cloudflared.exe"
"%CF%" tunnel --url http://localhost:3000

pause
