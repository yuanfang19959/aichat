# AI 智能伴侣

本地运行的伴侣聊天应用。页面可以新建对话、切换人设，并通过 DeepSeek 按当前昵称和性格回复。会话与消息保存在 MySQL 中。

## 环境要求

- Python 3.10+
- [uv](https://docs.astral.sh/uv/)
- MySQL，本机可访问
- DeepSeek API Key

## 配置

在项目根目录创建 `.env`（该文件已被 `.gitignore` 排除，不会提交）：

```
DEEPSEEK_API_KEY=你的密钥
```

数据库连接写在 `db.py` 中，默认是：

```
mysql+aiomysql://root@localhost:3306/ai_partner_db
```

先创建库和表：

```sql
CREATE DATABASE IF NOT EXISTS ai_partner_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_partner_db;

CREATE TABLE ai_preset (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  nick_name VARCHAR(50) NOT NULL,
  nature VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL,
  create_time DATETIME NOT NULL
);

CREATE TABLE ai_session (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_name VARCHAR(50) NOT NULL UNIQUE,
  nick_name VARCHAR(50) NOT NULL,
  nature VARCHAR(500) NOT NULL,
  create_time DATETIME NOT NULL,
  update_time DATETIME NOT NULL
);

CREATE TABLE ai_message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role VARCHAR(20) NOT NULL,
  content VARCHAR(500) NOT NULL,
  create_time DATETIME NOT NULL
);
```

人设下拉列表读取 `ai_preset`。`presets.json` 是一份示例人设，可按其中的 `name`、`nick_name`、`nature`、`sort_order` 写入该表，`create_time` 填当前时间。

## 启动

```bash
uv sync
uv run python main.py
```

浏览器打开 http://127.0.0.1:8000 。接口文档在 http://127.0.0.1:8000/docs 。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/patner/presets` | 人设预设列表 |
| GET | `/patner/sessions` | 会话列表 |
| POST | `/patner/sessions` | 创建会话，请求体为 `nick_name`、`nature` |
| GET | `/patner/sessions/{session_name}` | 会话详情和历史消息 |
| DELETE | `/patner/sessions/{session_name}` | 删除会话 |
| POST | `/patner/chat` | 发送消息，请求体为 `nick_name`、`nature`、`message`、`session_name` |

聊天接口使用模型 `deepseek-v4-pro`。系统提示词只发给模型，不写入消息表。
