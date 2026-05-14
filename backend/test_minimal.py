from fastapi import FastAPI
import uvicorn
import sys
import asyncio

print("测试服务器启动中...", flush=True)

# Windows 事件循环设置
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print("已设置 WindowsSelectorEventLoopPolicy", flush=True)

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ok", "port": 8081}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

print("尝试启动 uvicorn...", flush=True)
try:
    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="info")
    print("uvicorn.run() 返回（这不应该发生，除非服务器停止）", flush=True)
except Exception as e:
    print(f"错误: {e}", flush=True)
    import traceback
    traceback.print_exc()
