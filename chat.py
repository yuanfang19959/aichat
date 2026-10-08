import os
import logging

from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel
from db import session_factory, AiSession, AiMessage
from sqlalchemy import select, update


logging.basicConfig(
     level=logging.INFO,
     format="%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
)

# 读取项目根目录的 .env，供下面的 API Key 使用
load_dotenv(Path(__file__).resolve().parent / ".env")

router = APIRouter()

class ApiResponse(BaseModel):
    code: int = 200
    message: str = "操作成功"
    data: Any = None

class ChatRequest(BaseModel):
    nick_name: str
    nature: str
    message: str
    session_name: str


# 第一个 %s 是伴侣昵称，第二个 %s 是性格描述
SYSTEM_PROMPT_TEMPLATE = """你叫 %s，现在是用户的真实伴侣，请完全代入伴侣角色。
    规则：
        1. 每次只回1条消息
        2. 禁止任何场景或状态描述性文字
        3. 匹配用户的语言
        4. 回复简短，像微信聊天一样
        5. 有需要的话可以用❤️🌸等emoji表情
        6. 用符合伴侣性格的方式对话
        7. 回复的内容, 要充分体现伴侣的性格特征
        8. 不要太肉麻（比如想你之类的，就日常聊天）
    伴侣性格：
        - %s
    你必须严格遵守上述规则来回复用户。
    """

# DeepSeek 接口兼容 OpenAI SDK，密钥来自环境变量 DEEPSEEK_API_KEY
client = OpenAI(api_key=os.environ.get("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com")

@router.post("/apipatner/chat", summary="聊天", response_model=ApiResponse)
async def chat(request: ChatRequest) -> ApiResponse:
    """根据会话历史调用模型，并把本轮对话写入消息表。"""
    logging.info("聊天请求")
    async with session_factory() as session:
        result = await session.execute(select(AiSession).where(AiSession.session_name == request.session_name))
        ai_session = result.scalar_one_or_none()
        if ai_session is None:
            return ApiResponse(code=404, message="会话不存在")

        # 系统提示词只发给模型，不写入消息表
        system_prompt = SYSTEM_PROMPT_TEMPLATE % (request.nick_name, request.nature)
        logging.info(f"系统提示词: {system_prompt}")
        history_result = await session.execute(
            select(AiMessage)
            .where(AiMessage.session_id == ai_session.id)
            .order_by(AiMessage.create_time.asc(), AiMessage.id.asc())
        )
        history = [{"role": row.role, "content": row.content} for row in history_result.scalars().all()]
        # 先取出主键，避免会话关闭后访问已过期的对象
        session_id = ai_session.id

    # 顺序：系统提示词、历史消息、本轮用户消息
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": request.message}]
    response = client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=messages,
        stream=False,
    )
    ai_response = response.choices[0].message.content
    now = datetime.now()
    async with session_factory() as session:
        # 同一时间写入，靠自增 id 保证用户消息排在回复前面
        session.add_all([
            AiMessage(session_id=session_id, role="user", content=request.message, create_time=now),
            AiMessage(session_id=session_id, role="assistant", content=ai_response, create_time=now),
        ])
        await session.execute(
            update(AiSession)
            .where(AiSession.id == session_id)
            .values(nick_name=request.nick_name, nature=request.nature, update_time=now)
        )
        await session.commit()
    return ApiResponse(code=200, message="请求成功", data=ai_response)
