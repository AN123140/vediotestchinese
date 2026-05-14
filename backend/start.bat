@echo off
chcp 65001 >nul
cd /d D:\同声传译\subtitle-app\backend
echo 正在启动后端服务...
echo 按 Ctrl+C 停止服务
echo.
D:\app\python\python.exe -u server.py
pause
