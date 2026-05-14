@echo off
chcp 65001 >nul
title 视频字幕后端服务

echo ==========================================
echo  视频字幕后端服务
echo  http://127.0.0.1:8765
echo  关闭此窗口即停止服务
echo ==========================================
echo.

"D:\app\python\python.exe" -u "D:\同声传译\subtitle-app\backend\server.py"

echo.
echo 服务已退出
echo 按任意键关闭窗口...
pause >nul
