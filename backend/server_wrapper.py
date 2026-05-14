"""
后端服务包装器 - 保持运行并处理异常
"""
import os
import sys
import time
import subprocess

# 设置工作目录
os.chdir(r"D:\同声传译\subtitle-app\backend")

# 启动 uvicorn 作为子进程
python_exe = r"D:\app\python\python.exe"
env = os.environ.copy()
env["PYTHONUNBUFFERED"] = "1"

print("=" * 50)
print(" 视频字幕后端服务")
print(" http://127.0.0.1:8765")
print(" 关闭此窗口停止服务")
print("=" * 50)

process = subprocess.Popen(
    [python_exe, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8765", "--log-level", "info"],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    env=env
)

try:
    for line in process.stdout:
        print(line, end='')
except KeyboardInterrupt:
    print("\n用户中断")
    process.terminate()

process.wait()
print(f"\n服务退出，代码: {process.returncode}")
input("按回车键关闭...")
