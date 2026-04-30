# 申请数据查询权限（data_query）

本文档用于说明如何为指定 `dataview_id` 申请数据查询权限，适用于接口：

- `POST /api/auth-service/v1/data-auth/apply`

## 目标

为指定数据视图发起权限申请，请求体包含：

- `resource_id`: 数据视图 ID 列表（本场景传单个 `dataview_id`）
- `apply_type`: 申请类型（可留空字符串，按平台默认处理）
- `applicant_id`: 申请人 ID
- `applicant_name`: 申请人姓名
- `applicant_type`: 固定为 `user`
- `auth_operations`: 固定包含 `data_query`
- `expired_at`: 过期时间戳（秒）

## cURL 示例

```bash
curl --location --request POST 'http://127.0.0.1:8155/api/auth-service/v1/data-auth/apply' \
--header 'Authorization: Bearer <token>' \
--header 'Content-Type: application/json' \
--data-raw '{
  "resource_id": ["<dataview_id>"],
  "apply_type": "",
  "applicant_id": "<user_id>",
  "applicant_name": "<user_name>",
  "applicant_type": "user",
  "auth_operations": ["data_query"],
  "expired_at": 4084016461
}'
```

## Python 脚本

仓库内提供可执行脚本：

- `skills/smart-data-analysis/scripts/apply_data_auth.py`

### 必填参数

- `--dataview-id`
- `--user-id`
- `--user-name`

### 常用参数

- `--base-url`：默认 `http://127.0.0.1:8155`
- `--token`：Bearer Token（也可用环境变量 `DATA_AUTH_TOKEN`）
- `--expired-at`：默认 `4084016461`
- `--apply-type`：默认空字符串
- `--insecure`：HTTPS 场景下跳过证书校验

### 运行示例

```bash
python skills/smart-data-analysis/scripts/apply_data_auth.py \
  --dataview-id 02acc5c2-7e9b-46a8-a016-3a9681e1c230 \
  --user-id eb4dae48-3e12-11f1-b0e8-261248b384b3 \
  --user-name neo \
  --token "ory_at_xxx"
```

### 返回结果

脚本会打印接口返回 JSON；若请求失败会输出 HTTP 错误详情并以非 0 退出码结束。
