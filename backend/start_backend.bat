@echo off
chcp 65001 >nul
title Video Subtitle Backend

echo ==========================================
echo  Video Subtitle Backend Service
echo  http://127.0.0.1:8765
echo  Close this window to stop the service
echo ==========================================
echo.

set PYTHON=D:\app\python\python.exe
set SCRIPT=D:\同声传译\subtitle-app\backend\server.py

"%PYTHON%" -u "%SCRIPT%"

echo.
echo Service stopped.
echo Press any key to close...
pause >nul
