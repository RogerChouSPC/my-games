@echo off
title Sequence Numbers Launcher
cd /d "%~dp0"

echo ============================================================
echo   SEQUENCE NUMBERS - starting up
echo ============================================================
echo.
echo 1) Starting the game server in a separate window...
start "Sequence Numbers Server" cmd /k "npm run start"

echo 2) Waiting a few seconds for it to be ready...
timeout /t 9 /nobreak >nul

echo.
echo 3) Creating your public link with Cloudflare...
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
