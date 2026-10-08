import json
import os
import logging

from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select

from db import session_factory, AiPreset, AiSession, AiMessage

logging.basicConfig(
     level=logging.INFO,
     format="%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
)
router = APIRouter()

PRESETS_FILE = Path(__file__).resolve().parent / "presets.json"

class ApiResponse(BaseModel):
    code: int = 200
    message: str = "操作成功"
    data: Any = None

class User(BaseModel):
    id: int
    name: str
    nick_name: str
    nature: str
    sort_order: int

class CreateSessionRequest(BaseModel):
    nick_name: str
    nature: str


SESSIONS_DIR = "session"

def generate_session_name():
    """生成会话标识"""
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

def get_session_path(session_name: str) -> str:
    """获取会话文件路径"""
    return os.path.join(SESSIONS_DIR, f"{session_name}.json")


@router.get("/patner/presets", summary="获取预设伴侣信息列表", response_model=ApiResponse)
async def get_presets() -> ApiResponse:
    async with session_factory() as session:
        result = await session.execute(select(AiPreset).order_by(AiPreset.sort_order.asc()))
        presets_list = jsonable_encoder(result.scalars().all())

    return ApiResponse(code=200, message="伴侣预设模板文件加载成功~!", data=presets_list)

@router.get("/patner/sessions", summary="获取会话列表", response_model=ApiResponse)
async def list_sessions() -> ApiResponse:
    async with session_factory() as session:
        result = await session.execute(
            select(AiSession.session_name).order_by(AiSession.session_name.asc())
        )
        sessions_list = result.scalars().all()
    return ApiResponse(message="success", data=sessions_list)
        
@router.get("/patner/sessions/{session_name}", summary="获取会话详情", response_model=ApiResponse)
async def get_session(session_name: str) -> ApiResponse:
    async with session_factory() as session:
        result = await session.execute(select(AiSession).where(AiSession.session_name == session_name))
        ai_session = result.scalar_one_or_none()
        if ai_session is None:
            return ApiResponse(code=404, message="会话不存在")
        msg_result = await session.execute(
            select(AiMessage)
            .where(AiMessage.session_id == ai_session.id)
            .order_by(AiMessage.create_time.asc(), AiMessage.id.asc())
        )
        session_data = jsonable_encoder(ai_session)
        session_data["messages"] = [
            {"role": row.role, "content": row.content}
            for row in msg_result.scalars().all()
        ]
    return ApiResponse(message="success", data=session_data)

@router.post("/patner/sessions", summary="创建会话", response_model=ApiResponse)
async def create_session(request: CreateSessionRequest) -> ApiResponse:
    session_name = generate_session_name()
    now = datetime.now()
    async with session_factory() as session:
        session.add(AiSession(
            session_name=session_name,
            nick_name=request.nick_name,
            nature=request.nature,
            create_time=now,
            update_time=now,
        ))
        await session.commit()

    return ApiResponse(message="success", data=session_name)


@router.delete("/patner/sessions/{session_name}", summary="删除会话", response_model=ApiResponse)
async def delete_session(session_name: str) -> ApiResponse:
    async with session_factory() as session:
        await session.execute(delete(AiSession).where(AiSession.session_name == session_name))
        await session.commit()
        return ApiResponse(message="success")


