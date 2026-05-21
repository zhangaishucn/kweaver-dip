# 批量查询资源操作权限

本文档说明如何**批量校验**当前用户（或指定访问者）对若干资源是否**同时具备**请求中的全部操作权限，适用于接口：

- `POST /api/auth-service/v1/data-resource/operations`

## 认证（请求头）

所有请求须带 **`Authorization: Bearer <access_token>`** 和 `Content-Type: application/json`。

字段枚举与申请侧一致：`object_type` 见 [`resources/resource.md`](../resources/resource.md)，`action` 中操作码须与该资源类型在 [`resources/operations.md`](../resources/operations.md) 中可搭配，并与申请接口中的 `auth_operations` 使用**相同英文 code**。

## 📋 任务进度清单（阶段：查询）

- [ ] 待完成 · 步骤4（资源发现，按需）
- [ ] 待完成 · 步骤5（枚举与类型校验）
- [ ] 待完成 · 步骤6（构造查询请求体）
- [ ] 待完成 · 步骤7（调用权限查询接口）
- [ ] 待完成 · 步骤8（总结交付）

## 编排门禁流程（承接总入口步骤三后继续，序号连续）

进度执行硬约束（必须执行）：

- 每完成第 **4～8** 步中的任一步，都要立即输出一次进度。
- 进度模板固定为：
  - `## 📋 任务进度清单（阶段：查询）`
  - `- [x] 已完成 · 步骤N（步骤名称）`
  - `- [ ] 待完成 · 步骤N+1（步骤名称）`
- 若当前步骤尚未输出进度，**不得进入下一步**。
- 若发现缺步、跳步或步骤失败，必须**立即停止流程**并说明原因，不得继续执行。
- 流程在第 **8** 步结束时，须在清单中标注「步骤8（总结交付）已完成」并追加 **流程完成**。

## 目标

请求体（`dto.CurrentUserBatchEnforce`）主要字段：

- `resources`（必填）：资源列表；每项含 `object_id`、`object_type`；可选 `source_object_id`（按来源对象分组等场景，与鉴权域实现一致时传入）。
- `action`（必填）：待校验的操作列表，**非空数组**；服务端对**每一条**资源判断：仅当该资源允许的权限**覆盖 `action` 中全部操作**时，对应结果的 `effect` 为 `true`。
- `subject`（可选）：`subject_type` + `subject_id`。省略时从请求上下文取**当前登录用户**作为访问者。

请求头与申请接口相同：`Authorization: Bearer <access_token>`、`Content-Type: application/json`。

## cURL 示例

```bash
curl --location --request POST 'http://127.0.0.1:8155/api/auth-service/v1/data-resource/operations' \
  --header 'Authorization: Bearer <access_token>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "resources": [
      {
        "object_id": "<object_id_1>",
        "object_type": "data_view"
      },
      {
        "object_id": "<object_id_2>",
        "object_type": "knowledge_network"
      }
    ],
    "action": [
      "view_detail",
      "data_query"
    ]
  }'
```

### 可选：代查其他访问者

当需校验**非当前 token 用户**时传入 `subject`（取值须与平台访问者类型一致，如 `user`）：

```json
{
  "subject": {
    "subject_type": "user",
    "subject_id": "<user_id>"
  },
  "resources": [
    { "object_id": "<object_id>", "object_type": "data_view" }
  ],
  "action": ["data_query"]
}
```

## 降低 `json格式错误` 的建议（重点）

`AuthService` 对非法 JSON 可能返回 `PublicInvalidParameterJson`。建议：

1. **避免一行内联超长 JSON**：`curl` / `kweaver call` 优先用变量、heredoc 或文件体。
2. **固定 UTF-8**：Windows 终端可配合 `chcp 65001`。
3. **类型与字段名**：
   - 顶层字段名为 **`resources`**（数组），不是其他拼写。
   - `action` 为**数组**；每项为字符串操作码。
   - `object_id`、`object_type` 为字符串；枚举原值见Resource / Operations 清单。

### PowerShell 推荐写法（对象转 JSON）

```powershell
chcp 65001 | Out-Null

$payload = @{
  resources = @(
    @{ object_id = "8cd94e92-b4fc-469b-abbc-1f7916f5fbd8"; object_type = "data_view" }
  )
  action = @("view_detail", "data_query")
} | ConvertTo-Json -Depth 5 -Compress

kweaver call "/api/auth-service/v1/data-resource/operations" `
  -X POST `
  -H "Content-Type: application/json" `
  -d $payload
```

### Bash 推荐写法（heredoc）

```bash
payload=$(cat <<'JSON'
{
  "resources": [
    {
      "object_id": "8cd94e92-b4fc-469b-abbc-1f7916f5fbd8",
      "object_type": "data_view"
    }
  ],
  "action": [
    "view_detail",
    "data_query"
  ]
}
JSON
)

kweaver call "/api/auth-service/v1/data-resource/operations" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$payload"
```

### 快速自检清单

- 本地 `python -m json.tool` 或等价工具能解析请求体。
- 无中文引号、无尾逗号、`action` 非空数组。
- `object_type` 与 `action` 与目标资源类型匹配。
- 已设置 `Content-Type: application/json`。

## 返回结果

HTTP 200 时响应体为 JSON 数组，元素类型为 `ObjectAuthResultItem`：

- `object_id`：与请求中 `resources` 项对应的资源 ID。
- `effect`：`true` 表示允许，`false` 表示拒绝（对请求中的 `action` **全部**操作均通过校验时为 `true`，与 `enforcer.CurrentUserBatchEnforce` 中 `HasAllAction` 语义一致）。

示例：

```json
[
  { "object_id": "8cd94e92-b4fc-469b-abbc-1f7916f5fbd8", "effect": true },
  { "object_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "effect": false }
]
```

请求失败时以 4xx 及错误体为准；请保留接口返回的原始错误信息便于排错。
