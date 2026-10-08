from pathlib import Path
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from chat import router as chat_router
from index import router

load_dotenv(Path(__file__).resolve().parent / ".env")

# 创建FastAPI实例
app = FastAPI(title="AI智能伴侣", version="1.0.0")

# 挂载接口路由（每次只能挂一个）
app.include_router(router)
app.include_router(chat_router)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")


# 统一异常处理
@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    # request / exc 由 FastAPI 在捕获异常时自动传入
    logging.error(f"处理异常,请求路径为:{request.url}, 异常信息:{exc}")
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误", "data": None},
    )


@app.get("/")
async def root():
    print("访问项目首页")
    return FileResponse("static/index.html")


# 启动服务
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8002,
        reload=True,
        reload_excludes=[".venv"],
    )
