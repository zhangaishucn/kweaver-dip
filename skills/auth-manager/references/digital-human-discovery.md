# 数字员工查询（独立）

> 本文档仅说明数字员工**列表**与**详情**接口，用于在授权前搜索/确认数字员工（`digital_employee`）。

## 适用场景

- 用户只提供数字员工名称，需先检索候选数字员工。
- 用户已拿到数字员工 ID，需查询详情确认后再发起授权。

## 接口 1：数字员工列表

- 方法：`GET`
- 路径：`/api/dip-studio/v1/digital-human`
- 用途：获取数字员工列表，供名称匹配与候选选择。

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/dip-studio/v1/digital-human' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例：

```json
[
  {
    "id": "dh_sales_assistant",
    "name": "销售助手",
    "creature": "销售顾问",
    "icon_id": "assistant-blue"
  },
  {
    "id": "dh_finance_assistant",
    "name": "财务助手",
    "creature": "财务分析师",
    "icon_id": "assistant-green"
  }
]
```

常见返回字段：

- `id`
- `name`
- `creature`
- `icon_id`

## 接口 2：数字员工详情

- 方法：`GET`
- 路径：`/api/dip-studio/v1/digital-human/{id}`
- 用途：按数字员工 ID 获取详情，确认目标是否存在。

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/dip-studio/v1/digital-human/<digital_human_id>' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例：

```json
{
  "id": "dh_sales_assistant",
  "name": "销售助手",
  "creature": "销售顾问",
  "icon_id": "assistant-blue",
  "soul": "你是企业销售分析数字员工",
  "skills": ["kweaver-core", "smart-data-analysis"],
  "bkn": [
    {
      "name": "销售知识网络",
      "url": "kn_sales"
    }
  ]
}
```

常见返回字段：

- `id`
- `name`
- `creature`
- `icon_id`
- `soul`
- `skills`
- `bkn`

## 与授权流程衔接

1. 若用户只给了数字员工名称：先调用列表接口检索候选。  
2. 候选唯一：回填 `applicant_id`（数字员工 ID）并继续授权流程。  
3. 候选多个：让用户确认具体 `id` 后再继续。  
4. 已有 `applicant_id`：可直接调用详情接口做存在性校验。

