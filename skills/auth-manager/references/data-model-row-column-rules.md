# Data Model 视图行列规则接口（对外，独立）

> 本文档只整理 `data_model` 中“数据视图行列规则”的对外增删改查接口，独立于权限申请/权限查询主流程，避免混淆。  
> 来源：`idrm-go-common/rest/data_model/interface.go`、`idrm-go-common/rest/data_model/impl/data_model.go`。

## 基础路径

- `GET /api/mdl-data-model/v1/data-view-row-column-rules`（列表）
- `GET /api/mdl-data-model/v1/data-view-row-column-rules/{rule_ids}`（批量详情）
- `POST /api/mdl-data-model/v1/data-view-row-column-rules`（创建）
- `PUT /api/mdl-data-model/v1/data-view-row-column-rules/{rule_id}`（更新）
- `DELETE /api/mdl-data-model/v1/data-view-row-column-rules/{rule_ids}`（删除）

其中 `{rule_ids}` 为逗号分隔的规则 ID 列表。

## 1) 查询列表（List）

- 方法：`GET`
- 路径：`/api/mdl-data-model/v1/data-view-row-column-rules`
- 接口定位：对外列表接口

可用查询参数（`ListDataViewRowColumnRulesQuery`）：

- `name`
- `name_pattern`
- `view_id`
- `tag`
- `offset`
- `limit`
- `sort`
- `direction`

响应示例：

```json
{
  "entries": [
    {
      "id": "rule_001",
      "name": "订单规则-华东区",
      "view_id": "view_sales_order",
      "fields": ["order_id", "customer_name", "amount"],
      "row_filters": {
        "field": "region",
        "operation": "eq",
        "value": "华东"
      }
    }
  ],
  "total_count": 1
}
```

## 2) 查询详情（Get）

- 方法：`GET`
- 路径：`/api/mdl-data-model/v1/data-view-row-column-rules/{rule_ids}`
- 接口定位：对外详情接口

说明：

- `rule_ids` 至少一个，多个使用逗号拼接。

响应示例：

```json
[
  {
    "id": "rule_001",
    "name": "订单规则-华东区",
    "view_id": "view_sales_order",
    "fields": ["order_id", "customer_name", "amount"]
  },
  {
    "id": "rule_002",
    "name": "订单规则-华南区",
    "view_id": "view_sales_order",
    "fields": ["order_id", "customer_name", "amount"]
  }
]
```

## 3) 创建规则（Create）

- 方法：`POST`
- 路径：`/api/mdl-data-model/v1/data-view-row-column-rules`
- 接口定位：对外创建接口

请求体为数组，每项结构对应 `DataViewRowColumnRuleWrite`：

- `name`（必填）
- `view_id`（必填）
- `tags`（可选）
- `comment`（可选）
- `fields`（可选）
- `row_filters`（可选，结构为 `RowColumnCondCfg`）

返回为创建后的规则 ID 列表。

响应示例：

```json
[
  "rule_003"
]
```

## 4) 更新规则（Update）

- 方法：`PUT`
- 路径：`/api/mdl-data-model/v1/data-view-row-column-rules/{rule_id}`
- 接口定位：对外更新接口

说明：

- `rule_id` 必填且不能为空。
- 请求体结构同 `DataViewRowColumnRuleWrite`。

响应示例：

```json
{}
```

## 5) 删除规则（Delete）

- 方法：`DELETE`
- 路径：`/api/mdl-data-model/v1/data-view-row-column-rules/{rule_ids}`
- 接口定位：对外删除接口

说明：

- `rule_ids` 至少一个，多个使用逗号拼接。

响应示例：

```json
{}
```

## cURL 示例

```bash
# 1) 列表查询
curl --location --request GET 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-view-row-column-rules?view_id=<view_id>&offset=0&limit=10' \
  --header 'Authorization: Bearer <access_token>'

# 2) 批量详情
curl --location --request GET 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-view-row-column-rules/<rule_id_1>,<rule_id_2>' \
  --header 'Authorization: Bearer <access_token>'

# 3) 创建
curl --location --request POST 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-view-row-column-rules' \
  --header 'Authorization: Bearer <access_token>' \
  --header 'Content-Type: application/json' \
  --data-raw '[
    {
      "name": "订单规则-华东区",
      "view_id": "<view_id>",
      "fields": ["order_id", "customer_name", "amount"],
      "row_filters": {
        "field": "region",
        "operation": "eq",
        "value": "华东"
      }
    }
  ]'

# 4) 更新
curl --location --request PUT 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-view-row-column-rules/<rule_id>' \
  --header 'Authorization: Bearer <access_token>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "name": "订单规则-华东区-更新",
    "view_id": "<view_id>",
    "fields": ["order_id", "customer_name"],
    "row_filters": {
      "field": "region",
      "operation": "eq",
      "value": "华东"
    }
  }'

# 5) 删除（可批量）
curl --location --request DELETE 'http://127.0.0.1:8155/api/mdl-data-model/v1/data-view-row-column-rules/<rule_id_1>,<rule_id_2>' \
  --header 'Authorization: Bearer <access_token>'
```

