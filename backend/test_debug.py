import sys
import os
import traceback
import signal

print(f"Python 版本: {sys.version}", flush=True)
print(f"平台: {sys.platform}", flush=True)
print(f"工作目录: {os.getcwd()}", flush=True)

# 设置 Windows 事件循环
if sys.platform == "win32":
    import asyncio
    print("设置 WindowsSelectorEventLoopPolicy...", flush=True)
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print("  Done", flush=True)

try:
    from fastapi import FastAPI
    import uvicorn
    print("模块导入成功", flush=True)
except Exception as e:
    print(f"模块导入失败: {e}", flush=True)
    sys.exit(1)

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# 自定义信号处理（仅用于调试）
def signal_handler(signum, frame):
    print(f"收到信号: {signum}", flush=True)
    sys.exit(0)

if sys.platform != "win32":
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

print("开始启动 uvicorn...", flush=True)
print("如果看到 'Uvicorn running on...' 后程序退出，说明 uvicorn.run() 内部出错", flush=True)

try:
    # 尝试不同的 uvicorn 配置
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=8081,
        log_level="debug",  # 改为 debug 级别获取更多信息
        loop="asyncio"
    )
    server = uvicorn.Server(config)
    print("开始运行服务器...", flush=True)
    server.run()
    print("server.run() 返回（不应该发生，除非服务器停止）", flush=True)
except Exception as e:
    print(f"\n[ERROR] uvicorn 启动失败: {e}", flush=True)
    traceback.print_exc()
    print("按回车键退出...", flush=True)
    input()
except SystemExit as e:
    print(f"\n[INFO] 系统退出: {e}", flush=True)
    sys.exit(e.code if e.code else 0)
