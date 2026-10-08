import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Integer, String, DateTime, URL
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase

load_dotenv(Path(__file__).resolve().parent / ".env")

# 本地不设 MYSQL_PASSWORD。服务器在 .env 中填写，特殊字符由 URL 负责转义。
mysql_password = os.environ.get("MYSQL_PASSWORD") or None
database_url = URL.create(
    "mysql+aiomysql",
    username="root",
    password=mysql_password,
    host="localhost",
    port=3306,
    database="ai_partner_db",
)

# 1. 创建引擎(支持异步操作)
engine = create_async_engine(database_url, echo=True)

# 2. 声明模型类
class Base(DeclarativeBase):
    pass

class AiPreset(Base):
    """伴侣预设表"""
    __tablename__ = "ai_preset"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="预设名称")
    nick_name: Mapped[str] = mapped_column(String(50), nullable=False, comment="伴侣昵称")
    nature: Mapped[str] = mapped_column(String(500), nullable=False, comment="伴侣性格描述")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, comment="排序顺序")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")

    def __repr__(self):
        return f"AiPreset(id={self.id}, name={self.name}, nick_name={self.nick_name}, nature={self.nature}, sort_order={self.sort_order}, create_time={self.create_time})"


class AiSession(Base):
    """会话表"""
    __tablename__ = "ai_session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    session_name: Mapped[str]= mapped_column(String(50), unique=True, nullable=False, comment="会话名称")
    nick_name: Mapped[str] = mapped_column(String(50), nullable=False, default="小甜甜", comment="伴侣昵称")
    nature: Mapped[str] = mapped_column(String(500), nullable=False, default="活泼开朗的东北姑娘", comment="伴侣性格")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")
    update_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="更新时间")

    def __repr__(self):
        return f"AiSession(id={self.id}, session_id={self.session_name}, nick_name={self.nick_name}, nature={self.nature}, create_time={self.create_time}, update_time={self.update_time})"


class AiMessage(Base):
    """消息表"""
    __tablename__ = "ai_message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    session_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="会话ID")
    role: Mapped[str] = mapped_column(String(20), nullable=False, comment="消息角色：user-用户，assistant-AI")
    content: Mapped[str] = mapped_column(String(500), nullable=False, comment="消息内容")
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="创建时间")

    def __repr__(self):
        return f"AiMessage(id={self.id}, session_id={self.session_id}, role={self.role}, content={self.content}, create_time={self.create_time})"

# 3. 会话工厂(支持异步操作)
session_factory = async_sessionmaker(engine)