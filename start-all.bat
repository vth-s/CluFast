@echo off
echo Iniciando CordFast...

start "CordFast Server" cmd /c "cd /d C:\CluFast && pnpm dev:server"
timeout /t 5 /nobreak >nul
start "CordFast Tunnel" cmd /c "C:\cloudflared\cloudflared.exe tunnel --config C:\cloudflared\config.yml run cordfast"

echo Todo iniciado.
pause
