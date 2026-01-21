@echo off
:: ============================================
:: AgartPOS Server Startup Script
:: Auto-restarts if server crashes
:: Logs all output to server.log
:: ============================================

title AgartPOS - Server

echo ============================================
echo   AgartPOS Server
echo   Running on http://localhost:5000
echo ============================================
echo.

:: Change to project directory
cd /d "C:\Users\USER\Desktop\AgartPOS"

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Wait a moment for system to settle after boot
timeout /t 5 /nobreak >nul

:: Clear old log on startup (keep last 1000 lines)
if exist "logs\server.log" (
    powershell -NoProfile -Command "Get-Content logs\server.log -Tail 1000 | Set-Content logs\server.log.tmp; Move-Item -Force logs\server.log.tmp logs\server.log" 2>nul
)

:: Infinite loop to restart server if it crashes
:loop
echo [%date% %time%] Starting AgartPOS Server... >> logs\server.log
echo [%date% %time%] Starting AgartPOS Server...
echo.

:: Check if port 5000 is already in use
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [%date% %time%] WARNING: Port 5000 is already in use. Attempting to free it... >> logs\server.log
    echo [%date% %time%] WARNING: Port 5000 is already in use. Attempting to free it...

    :: Try to kill the process using port 5000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
        echo [%date% %time%] Killing process %%a on port 5000 >> logs\server.log
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 3 /nobreak >nul
)

:: Run the development server and log output
call npm run dev 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath logs\server.log"

:: Capture exit code
set EXIT_CODE=%errorlevel%
echo.
echo [%date% %time%] Server stopped with exit code %EXIT_CODE%. Restarting in 5 seconds... >> logs\server.log
echo [%date% %time%] Server stopped with exit code %EXIT_CODE%. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
