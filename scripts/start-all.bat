@echo off
:: ============================================
:: AgartPOS Master Startup Script
:: Starts both Server and Cloudflare Tunnel
:: ============================================

title AgartPOS - Startup

echo ============================================
echo   AgartPOS Auto-Startup
echo   Starting Server + Cloudflare Tunnel
echo ============================================
echo.

:: Change to project directory
cd /d "C:\Users\USER\Desktop\AgartPOS"

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Log startup
echo [%date% %time%] ============================================ >> logs\startup.log
echo [%date% %time%] AgartPOS Master Startup Initiated >> logs\startup.log
echo [%date% %time%] ============================================ >> logs\startup.log

:: Check if npm is available
where npm >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: npm not found in PATH >> logs\startup.log
    echo ERROR: npm not found! Please install Node.js.
    pause
    exit /b 1
)
echo [%date% %time%] npm found >> logs\startup.log

:: Check if cloudflared is available
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] WARNING: cloudflared not found - tunnel will not start >> logs\startup.log
    echo WARNING: cloudflared not found. Tunnel will not start.
    echo Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
)

:: Start the POS server in a new window (minimized)
echo [%date% %time%] Starting POS Server... >> logs\startup.log
echo Starting POS Server...
start /min "AgartPOS Server" cmd /c "C:\Users\USER\Desktop\AgartPOS\scripts\start-server.bat"

:: Wait for server to start before starting tunnel
echo [%date% %time%] Waiting 15s for server to initialize... >> logs\startup.log
echo Waiting for server to initialize...
timeout /t 15 /nobreak >nul

:: Verify server is running
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] WARNING: Server may not be ready yet (port 5000 not listening) >> logs\startup.log
    echo WARNING: Server may not be ready yet. Continuing anyway...
) else (
    echo [%date% %time%] Server is listening on port 5000 >> logs\startup.log
    echo Server is ready on port 5000!
)

:: Start Cloudflare tunnel in a new window (minimized)
where cloudflared >nul 2>&1
if not errorlevel 1 (
    echo [%date% %time%] Starting Cloudflare Tunnel... >> logs\startup.log
    echo Starting Cloudflare Tunnel...
    start /min "AgartPOS Tunnel" cmd /c "C:\Users\USER\Desktop\AgartPOS\scripts\start-tunnel.bat"
) else (
    echo [%date% %time%] Skipping tunnel (cloudflared not installed) >> logs\startup.log
    echo Skipping tunnel (cloudflared not installed)
)

echo.
echo ============================================
echo   Both services started!
echo   - Server: http://localhost:5000
echo   - Tunnel: Check tunnel window for URL
echo   - Logs:   C:\Users\USER\Desktop\AgartPOS\logs\
echo ============================================
echo.
echo [%date% %time%] Startup complete >> logs\startup.log

echo You can close this window now.
timeout /t 10
exit
