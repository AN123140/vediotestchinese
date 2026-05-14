"""
后端服务保持运行脚本
用法: python keep_alive.py
"""
import subprocess
import sys
import time

PYTHON = r"D:\app\python\python.exe"
SCRIPT = r"D:\同声传译\subtitle-app\backend\server.py"

print("=" * 50)
print(" 视频字幕后端服务 - 自动重启守护")
print(" 按 Ctrl+C 停止")
print("=" * 50)

while True:
    print(f"\n[{time.strftime('%H:%M:%S')}] 启动后端服务...")
    try:
        process = subprocess.Popen(
            [PYTHON, "-u", SCRIPT],
            stdout=sys.stdout,
            stderr=sys.stderr,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        process.wait()
        print(f"\n[{time.strftime('%H:%M:%S')}] 后端退出，代码: {process.returncode}")
    except KeyboardInterrupt:
        print("\n用户中断，停止守护")
        if process:
            process.terminate()
        break
    except Exception as e:
        print(f"\n[{time.strftime('%H:%M:%S')}] 错误: {e}")

    print(f"[{time.strftime('%H:%M:%S')}] 5秒后自动重启...")
    time.sleep(5)
