@echo off
:: ============================================
:: Cloudflare Tunnel Startup Script
:: Auto-reconnects if tunnel drops
:: Logs all output to tunnel.log
:: ============================================

title AgartPOS - Cloudflare Tunnel

echo ============================================
echo   AgartPOS Cloudflare Tunnel
echo   Starting tunnel to localhost:5000
echo ============================================
echo.

:: Change to project directory
cd /d "C:\Users\USER\Desktop\AgartPOS"

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Clear old log on startup (keep last 500 lines)
if exist "logs\tunnel.log" (
    powershell -NoProfile -Command "Get-Content logs\tunnel.log -Tail 500 | Set-Content logs\tunnel.log.tmp; Move-Item -Force logs\tunnel.log.tmp logs\tunnel.log" 2>nul
)

:: Wait for network to be available (important after restart)
echo [%date% %time%] Waiting for network connection... >> logs\tunnel.log
echo Waiting for network connection...

set RETRY_COUNT=0
:waitnet
ping -n 1 1.1.1.1 >nul 2>&1
if errorlevel 1 (
    set /a RETRY_COUNT+=1
    if %RETRY_COUNT% geq 60 (
        echo [%date% %time%] ERROR: Network not available after 5 minutes. Continuing anyway... >> logs\tunnel.log
        echo ERROR: Network not available after 5 minutes. Continuing anyway...
        goto startloop
    )
    timeout /t 5 /nobreak >nul
    goto waitnet
)
echo [%date% %time%] Network is available! >> logs\tunnel.log
echo Network is available!
echo.

:: Wait for server to be ready (check if port 5000 is listening)
echo [%date% %time%] Waiting for POS server to be ready... >> logs\tunnel.log
echo Waiting for POS server to be ready...

set SERVER_WAIT=0
:waitserver
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    set /a SERVER_WAIT+=1
    if %SERVER_WAIT% geq 60 (
        echo [%date% %time%] WARNING: Server not detected after 5 minutes. Starting tunnel anyway... >> logs\tunnel.log
        echo WARNING: Server not detected after 5 minutes. Starting tunnel anyway...
        goto startloop
    )
    timeout /t 5 /nobreak >nul
    goto waitserver
)
echo [%date% %time%] POS Server is ready! >> logs\tunnel.log
echo POS Server is ready!
echo.

:startloop
set TUNNEL_FAILURES=0

:: Infinite loop to restart tunnel if it crashes
:loop
echo [%date% %time%] Starting Cloudflare Tunnel... >> logs\tunnel.log
echo [%date% %time%] Starting Cloudflare Tunnel...
echo.

:: Run cloudflared and log output
:: Option 1: Quick tunnel (temporary URL)
cloudflared tunnel --url http://localhost:5000 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath logs\tunnel.log"

:: Capture exit code
set EXIT_CODE=%errorlevel%
set /a TUNNEL_FAILURES+=1

echo.
echo [%date% %time%] Tunnel disconnected (exit code: %EXIT_CODE%, failures: %TUNNEL_FAILURES%). >> logs\tunnel.log
echo [%date% %time%] Tunnel disconnected (exit code: %EXIT_CODE%, failures: %TUNNEL_FAILURES%).

:: Exponential backoff for repeated failures (max 60 seconds)
if %TUNNEL_FAILURES% geq 5 (
    set WAIT_TIME=60
) else if %TUNNEL_FAILURES% geq 3 (
    set WAIT_TIME=30
) else (
    set WAIT_TIME=10
)

echo Restarting in %WAIT_TIME% seconds... >> logs\tunnel.log
echo Restarting in %WAIT_TIME% seconds...
timeout /t %WAIT_TIME% /nobreak >nul

:: Reset failure count after successful long run (if we get here quickly, count stays)
goto loop
