"""
后端守护进程 - 自动监控并重启 Whisper 后端服务
用法: python backend/start_backend.py
"""

import subprocess
import sys
import time
import os
from datetime import datetime

PYTHON = sys.executable
SERVER_SCRIPT = os.path.join(os.path.dirname(__file__), "server.py")
LOG_FILE = os.path.join(os.path.dirname(__file__), "backend.log")
HOST, PORT = "127.0.0.1", 8765
MAX_RESTART_INTERVAL = 10  # 两次重启之间最少间隔秒数，防止频繁重启
MAX_RESTART_PER_MINUTE = 3  # 每分钟最多重启次数


def log(msg):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def check_port_alive(host, port):
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect((host, port))
        s.close()
        return True
    except (ConnectionRefusedError, OSError):
        return False


def main():
    log("=" * 50)
    log("Whisper 后端守护进程已启动")
    log(f"Python: {PYTHON}")
    log(f"Server: {SERVER_SCRIPT}")
    log(f"日志文件: {LOG_FILE}")
    log("=" * 50)

    restart_times = []

    while True:
        # 检查是否已有一个实例在运行
        if check_port_alive(HOST, PORT):
            log(f"端口 {PORT} 已被占用，服务可能已在运行")
            log("等待 60 秒后重新检查...")
            time.sleep(60)
            continue

        # 防止频繁重启
        now = time.time()
        restart_times = [t for t in restart_times if now - t < 60]
        if len(restart_times) >= MAX_RESTART_PER_MINUTE:
            log(f"1 分钟内已重启 {len(restart_times)} 次，等待 60 秒...")
            time.sleep(60)
            restart_times.clear()

        log("正在启动后端服务...")
        restart_times.append(time.time())

        process = subprocess.Popen(
            [PYTHON, SERVER_SCRIPT],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=os.path.dirname(__file__),
        )

        # 实时输出日志
        while True:
            line = process.stdout.readline()
            if not line:
                break
            line = line.rstrip()
            print(line, flush=True)
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {line}\n")

        process.wait()
        exit_code = process.returncode

        if exit_code == 0:
            log("后端服务正常退出，守护进程结束")
            break
        else:
            log(f"后端服务异常退出 (exit code: {exit_code})，{MAX_RESTART_INTERVAL} 秒后自动重启...")
            time.sleep(MAX_RESTART_INTERVAL)


if __name__ == "__main__":
    main()
