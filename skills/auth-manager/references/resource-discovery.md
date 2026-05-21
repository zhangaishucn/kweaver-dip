# 资源发现（自动补齐 `resource_id`）

当用户只给出资源名称（未给 `resource_id`）时，先执行资源发现，再继续权限申请或权限查询。

## 适用场景

- 用户说“给我开通某个视图权限”，但只给了视图名。
- 用户说“查我对某个知识网络有没有权限”，但只给了网络名。
- 用户给了模糊关键词（如“订单视图”），需要先检索候选资源。

## 发现规则（必须遵守）

1. 先根据意图确定 `resource_type` / `object_type`（`data_view` 或 `knowledge_network`）。
2. 若请求体缺 `resource_id`（申请）或 `resources[].object_id`（查询），必须先查候选资源。
3. 单候选：自动回填 ID 并继续后续接口。
4. 多候选：列出候选（`id` + `name`）并让用户确认，不得臆造。
5. 零候选：停止后续调用，返回“未找到可匹配资源”并建议更精确关键词。

## Data View 资源发现

接口：

- `GET /api/mdl-data-model/v1/data-views?name=<resource_name>`

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-views?name=<resource_name>' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例：

```json
{
  "entries": [
    {
      "id": "02acc5c2-7e9b-46a8-a016-3a9681e1c230",
      "name": "销售订单明细视图"
    }
  ],
  "total_count": 1
}
```

响应通常包含 `entries` 列表（不同部署字段可能略有差异）。请从候选中提取 `id` 与 `name`。

## Knowledge Network 资源发现

接口：

- `GET /api/bkn-backend/v1/knowledge-networks?name_pattern=<resource_name>&offset=0&limit=20`

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/bkn-backend/v1/knowledge-networks?name_pattern=<resource_name>&offset=0&limit=20' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例：

```json
{
  "entries": [
    {
      "id": "kn_sales",
      "name": "销售知识网络"
    }
  ],
  "total_count": 1
}
```

响应通常包含 `entries` 列表。请从候选中提取 `id` 与 `name`。

## 与主流程衔接

- **申请分支**：回填到 `resource_id` 后，按 [`auth-apply.md`](./auth-apply.md) 继续。
- **查询分支**：回填到 `resources[].object_id` 后，按 [`auth-query.md`](./auth-query.md) 继续。
- 查询分支若未指定 `subject`，默认校验当前 token 用户，无需额外提供 `user_id`。

