@echo off
chcp 65001 >nul
echo ==========================================
echo  视频字幕后端服务 - 自动重启守护
echo  按 Ctrl+C 停止
echo ==========================================
:loop
  echo [%date% %time%] 启动后端服务...
  "D:\app\python\python.exe" -u server.py
  echo [%date% %time%] 后端退出，5秒后自动重启...
  timeout /t 5 /nobreak >nul
goto loop
