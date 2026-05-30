@echo off
title Number Wars - LIVE PREVIEW (dev)
cd /d "%~dp0"

echo ============================================================
echo   NUMBER WARS - LIVE PREVIEW (hot reload, for editing)
echo ============================================================
echo.
echo This runs the DEV server: code edits show on a browser REFRESH,
echo with no rebuild or restart. (Slightly slower than the real game.)
echo For an actual game night, use start-game.bat instead.
echo.

echo 1) Closing any old server on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

echo 2) Starting the dev server (hot reload) in a separate window...
start "Number Wars DEV Server" cmd /k "npm run dev"

echo 3) Waiting a few seconds for it to be ready...
timeout /t 7 /nobreak >nul

echo.
echo 4) Creating your live-preview link with Cloudflare...
echo.
echo    LOOK FOR:  https://something.trycloudflare.com
echo    Open it, and just REFRESH after each edit to see changes.
echo.
echo    Keep BOTH windows open while previewing.
echo ============================================================
echo.

set "CF=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CF%" set "CF=C:\Program Files\cloudflared\cloudflared.exe"
"%CF%" tunnel --url http://localhost:3000

pause
