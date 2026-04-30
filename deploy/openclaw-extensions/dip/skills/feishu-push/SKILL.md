---
name: feishu-push
description: >-
  向飞书指定用户（通过OpenID/union_id/user_id/email/chat_id）推送消息。
  支持文本、卡片、图片、文件等多种消息类型。当用户需要给飞书用户/群组发送推送消息时自动使用。
allowed-tools: Bash(curl *), Python(*), node(*)
argument-hint: <openid> <message-content> [msg_type]
---

# Feishu Push Message Skill

通过飞书开放平台 API 向指定飞书用户或群组推送消息。

## 前提条件

1. 需要已经创建飞书自定义应用，并启用机器人能力
2. 应用已获取 `im:message`（或 `im:message:send_as_bot`）权限
3. 目标用户需要在应用的可用范围内
4. 需要配置以下环境变量或凭据：
   - `FEISHU_APP_ID`: 飞书应用 App ID (如 `cli_a94a1d897cb85cbb`)
   - `FEISHU_APP_SECRET`: 飞书应用 App Secret

## API 端点

```
POST https://open.feishu.cn/open-apis/im/v1/messages
```

## 使用方式

### 命令行方式（curl）

```bash
# 获取 tenant_access_token
TOKEN=$(curl -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"app_id\":\"$FEISHU_APP_ID\",\"app_secret\":\"$FEISHU_APP_SECRET\"}" | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['tenant_access_token'])")

# 发送文本消息
curl --request POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id" \
  --header "Authorization: Bearer $TOKEN" \
  --header "Content-Type: application/json; charset=utf-8" \
  --data-raw '{
    "receive_id": "<OPEN_ID>",
    "msg_type": "text",
    "content": "{\"text\":\"你的消息内容\"}"
  }'
```

### 支持的接收者 ID 类型

| receive_id_type | 说明 |
|-----------------|------|
| `open_id` | 用户在应用内的 Open ID（推荐用于用户） |
| `union_id` | 开发者租户内统一用户 ID |
| `user_id` | 租户内用户 ID |
| `email` | 用户邮箱 |
| `chat_id` | 群组 ID |

### 支持的消息类型

| msg_type | 说明 |
|----------|------|
| `text` | 文本消息 |
| `post` | 富文本消息 |
| `image` | 图片消息（需要先上传图片获取 key）|
| `file` | 文件消息（需要先上传文件获取 key）|
| `audio` | 音频消息 |
| `media` | 视频消息 |
| `sticker` | 表情 |
| `interactive` | 互动卡片 |
| `share_chat` | 分享群名片 |
| `share_user` | 分享个人名片 |
| `system` | 系统消息（仅单会话有效）|

## 示例

### 发送文本消息给指定 OpenID 用户

```bash
# 用法: feishu-push text <open_id> "你的消息内容"
```

### 环境变量配置

推荐在环境中配置应用凭证：
```bash
export FEISHU_APP_ID="cli_a94a1d897cb85cbb"
export FEISHU_APP_SECRET="your_app_secret_here"
```

## 错误处理

常见错误码及处理：

- `230013`: Bot 对该用户无可用权限 → 将用户添加到应用可用范围
- `230006`: 未启用机器人能力 → 在飞书开发者后台启用 bot 能力
- `230029`: 用户已离职 → 无法发送给已离职用户
- `230053`: 用户停止接收机器人消息 → 用户需要取消拉黑

## Python 示例

```python
import os
import json
import requests

def get_tenant_access_token():
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    payload = {
        "app_id": app_id,
        "app_secret": app_secret
    }
    
    response = requests.post(url, json=payload)
    data = response.json()
    
    if data.get("code") != 0:
        raise Exception(f"Failed to get token: {data.get('msg')}")
    
    return data["tenant_access_token"]

def send_text_message(receive_id: str, content: str, receive_id_type: str = "open_id"):
    token = get_tenant_access_token()
    
    url = f"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={receive_id_type}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    msg_content = json.dumps({"text": content})
    
    payload = {
        "receive_id": receive_id,
        "msg_type": "text",
        "content": msg_content
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

if __name__ == "__main__":
    # Example: send message to open_id
    # python send.py <open_id> "message text"
    import sys
    if len(sys.argv) >= 3:
        result = send_text_message(sys.argv[1], sys.argv[2])
        print(json.dumps(result, indent=2, ensure_ascii=False))
```

## 调用示例

```
/feishu-push 给用户 ou_7999079c3251552c855725a3fd3a1deb 发送文本消息 "Hello from OpenClaw!"
/feishu-push send openid ou_7999079c3251552c855725a3fd3a1deb "这是一条测试推送消息"
```
