"""
后端服务守护进程 - 自动重启
"""
import subprocess
import sys
import time

PYTHON = r"D:\app\python\python.exe"
SERVER_SCRIPT = "server.py"

def start_server():
    """启动后端服务并监控"""
    print("=" * 50)
    print(" 视频字幕后端服务守护进程")
    print(" 按 Ctrl+C 停止")
    print("=" * 50)

    while True:
        print(f"\n[{time.strftime('%H:%M:%S')}] 启动后端服务...")
        try:
            process = subprocess.Popen(
                [PYTHON, "-u", SERVER_SCRIPT],
                cwd=r"D:\同声传译\subtitle-app\backend",
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace'
            )

            # 实时输出日志
            for line in process.stdout:
                print(line, end='')

            process.wait()
            print(f"\n[{time.strftime('%H:%M:%S')}] 后端退出，代码: {process.returncode}")

        except KeyboardInterrupt:
            print("\n用户中断，停止守护进程")
            if process:
                process.terminate()
            break
        except Exception as e:
            print(f"\n[{time.strftime('%H:%M:%S')}] 错误: {e}")

        print(f"[{time.strftime('%H:%M:%S')}] 5秒后自动重启...")
        time.sleep(5)

if __name__ == "__main__":
    start_server()
