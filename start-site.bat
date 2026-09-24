@echo off
setlocal
cd /d "%~dp0"

echo Starting Lantern Roster backend (port 4100)...
start "Lantern Roster - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Starting Lantern Roster frontend (port 5273)...
start "Lantern Roster - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for the frontend to come up...
timeout /t 6 /nobreak >nul

start "" "http://localhost:5273"

endlocal
