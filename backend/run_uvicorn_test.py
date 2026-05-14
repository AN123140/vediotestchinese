import subprocess
import sys

print("正在启动 uvicorn...", flush=True)
try:
    result = subprocess.run(
        [r"D:\app\python\python.exe", "-m", "uvicorn", "server:app", 
         "--host", "127.0.0.1", "--port", "8081", "--log-level", "info"],
        cwd=r"D:\同声传译\subtitle-app\backend",
        capture_output=True,
        encoding='utf-8',  # 指定 UTF-8 编码
        errors='ignore',    # 忽略解码错误
        timeout=10
    )
    print("STDOUT:", result.stdout, flush=True)
    print("STDERR:", result.stderr, flush=True)
    print("返回码:", result.returncode, flush=True)
except subprocess.TimeoutExpired as e:
    print("进程超时（正常，因为服务会持续运行）", flush=True)
    if e.stdout:
        print("STDOUT:", e.stdout.decode('utf-8', errors='ignore'), flush=True)
    if e.stderr:
        print("STDERR:", e.stderr.decode('utf-8', errors='ignore'), flush=True)
except Exception as e:
    print(f"错误: {e}", flush=True)
    import traceback
    traceback.print_exc()
