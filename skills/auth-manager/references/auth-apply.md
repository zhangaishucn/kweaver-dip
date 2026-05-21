# 申请数据查询权限（data_query）

本文档用于说明如何为指定 `dataview_id` 申请数据查询权限，适用于接口：

- `POST /api/auth-service/v1/data-auth/apply`

## 认证（请求头）

所有请求须带 **`Authorization: Bearer <access_token>`** 和 `Content-Type: application/json`。

## 📋 任务进度清单（阶段：申请）

- [ ] 待完成 · 步骤4（资源发现，按需）
- [ ] 待完成 · 步骤5（申请人发现，按需）
- [ ] 待完成 · 步骤6（数字员工发现，按需）
- [ ] 待完成 · 步骤7（行列规则校验，按需）
- [ ] 待完成 · 步骤8（applicant 存在性校验，按需）
- [ ] 待完成 · 步骤9（申请前权限预检）
- [ ] 待完成 · 步骤10（构造并调用申请接口）
- [ ] 待完成 · 步骤11（总结交付）

## 编排门禁流程（承接总入口步骤三后继续，序号连续）

进度执行硬约束（必须执行）：

- 每完成第 **4～11** 步中的任一步，都要立即输出一次进度。
- 进度模板固定为：
  - `## 📋 任务进度清单（阶段：申请）`
  - `- [x] 已完成 · 步骤N（步骤名称）`
  - `- [ ] 待完成 · 步骤N+1（步骤名称）`
- 若当前步骤尚未输出进度，**不得进入下一步**。
- 若发现缺步、跳步或步骤失败，必须**立即停止流程**并说明原因，不得继续执行。
- 若步骤9预检已全部 `effect=true`，可在步骤9后直接标注 **流程完成**（无需执行步骤10）。
- 流程在第 **11** 步结束时，须在清单中标注「步骤11（总结交付）已完成」并追加 **流程完成**。

## 目标

为指定数据视图发起权限申请，请求体包含：

- `resource_id`: 数据视图 ID 列表（本场景传单个 `dataview_id`）
- `apply_type`: 申请类型（可留空字符串，按平台默认处理）
- `applicant_id`: 申请人 ID
- `applicant_name`: 申请人姓名
- `applicant_type`: 固定为 `user`
- `auth_operations`: 固定包含 `data_query`
- `expired_at`: 过期时间戳（秒）

## 申请前建议（避免重复申请）

在提交 `/api/auth-service/v1/data-auth/apply` 前，建议先调用 `/api/auth-service/v1/data-resource/operations` 对同一申请人做权限校验：

- 若目标操作已全部具备（`effect=true`），则无需重复申请。
- 若存在未具备操作（`effect=false`），再提交申请。

> 全局重试约束补充：当申请接口因失败触发“单次重试”时，重试前仍需再次执行上述权限预检；若重试前已全部 `effect=true`，直接结束并返回“无需申请”。

## cURL 示例

```bash
curl --location --request POST 'http://127.0.0.1:8155/api/auth-service/v1/data-auth/apply' \
--header 'Authorization: Bearer <access_token>' \
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

> 推荐优先使用该脚本发起申请，可显著降低命令行转义导致的 `json格式错误`。

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

## 降低 `json格式错误` 的建议（重点）

`AuthService.Public.InvalidParameterJson` 通常由命令行转义、引号嵌套、编码或请求体拼接错误导致。建议按以下顺序处理：

1. **首选 Python 脚本**：优先使用 `apply_data_auth.py`，避免手工拼接 JSON。
2. **避免内联长 JSON**：若必须用 `kweaver call/curl`，优先使用“文件请求体”或变量，而不是一行内联字符串。
3. **固定 UTF-8**：Windows 下先执行 `chcp 65001`，避免乱码或解析异常。
4. **字段类型严格匹配**：
   - `resource_id` 必须是数组（如 `["<dataview_id>"]`）
   - `auth_operations` 必须是数组（如 `["data_query"]` / `["view_detail"]`）
   - `expired_at` 必须是数字（不要加引号）

### PowerShell 推荐写法（对象转 JSON，避免手写转义）

```powershell
chcp 65001 | Out-Null

$payload = @{
  resource_id     = @("02acc5c2-7e9b-46a8-a016-3a9681e1c230")
  apply_type      = ""
  applicant_id    = "06e570ec-446b-11f1-8476-261248b384b3"
  applicant_name  = "neo"
  applicant_type  = "user"
  auth_operations = @("data_query")
  expired_at      = 4084016461
} | ConvertTo-Json -Depth 5 -Compress

kweaver call "/api/auth-service/v1/data-auth/apply" `
  -X POST `
  -H "Content-Type: application/json" `
  -d $payload
```

### Bash 推荐写法（heredoc）

```bash
payload=$(cat <<'JSON'
{
  "resource_id": ["02acc5c2-7e9b-46a8-a016-3a9681e1c230"],
  "apply_type": "",
  "applicant_id": "06e570ec-446b-11f1-8476-261248b384b3",
  "applicant_name": "neo",
  "applicant_type": "user",
  "auth_operations": ["data_query"],
  "expired_at": 4084016461
}
JSON
)

kweaver call "/api/auth-service/v1/data-auth/apply" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$payload"
```

### 快速自检清单

- JSON 能被本地解析（如 `python -m json.tool` 检查通过）
- 没有多余反斜杠、中文引号、尾逗号
- `resource_id` / `auth_operations` 不是字符串而是数组
- `Content-Type` 已设置为 `application/json`
