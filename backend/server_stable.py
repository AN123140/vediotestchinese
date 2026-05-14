"""
稳定版后端启动器 - 处理端口占用和自动重启
"""
import os
import sys
import socket
import subprocess
import time

PORT = 8765
HOST = "127.0.0.1"

def is_port_in_use(port):
    """检查端口是否被占用"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, port)) == 0

def kill_process_on_port(port):
    """终止占用端口的进程"""
    try:
        # 使用 netstat 查找占用端口的 PID
        result = subprocess.run(
            ['netstat', '-ano', '|', 'findstr', f':{port}'],
            capture_output=True, text=True, shell=True
        )
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    print(f"终止占用端口 {port} 的进程 PID: {pid}")
                    subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
                    time.sleep(1)
                    return True
    except Exception as e:
        print(f"清理端口失败: {e}")
    return False

def start_server():
    """启动后端服务"""
    # 检查并释放端口
    if is_port_in_use(PORT):
        print(f"端口 {PORT} 被占用，尝试释放...")
        kill_process_on_port(PORT)

    # 等待端口释放
    for i in range(5):
        if not is_port_in_use(PORT):
            break
        time.sleep(1)
    else:
        print(f"无法释放端口 {PORT}，请手动检查")
        sys.exit(1)

    print("=" * 50)
    print(" 视频字幕后端服务")
    print(f" http://{HOST}:{PORT}")
    print(" 按 Ctrl+C 停止")
    print("=" * 50)

    # 启动服务器
    server_path = os.path.join(os.path.dirname(__file__), 'server.py')
    python_exe = r"D:\app\python\python.exe"

    process = subprocess.Popen(
        [python_exe, '-u', server_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace'
    )

    # 实时输出日志
    try:
        for line in process.stdout:
            print(line, end='')
    except KeyboardInterrupt:
        print("\n用户中断")
        process.terminate()

if __name__ == "__main__":
    start_server()
