import sys
import traceback
import asyncio

print("开始测试 uvicorn.run()...", flush=True)

try:
    from fastapi import FastAPI
    import uvicorn
    
    app = FastAPI()
    
    @app.get("/")
    def read_root():
        return {"status": "ok"}
    
    print("尝试启动 uvicorn...", flush=True)
    print("如果程序在此退出且无输出，可能是事件循环问题", flush=True)
    
    # 尝试设置 Windows 事件循环策略
    if sys.platform == "win32":
        print("设置 Windows 事件循环策略...", flush=True)
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # 尝试启动
    uvicorn.run(app, host="127.0.0.1", port=8081, log_level="info")
    
except Exception as e:
    print(f"\n[ERROR] 错误: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)
