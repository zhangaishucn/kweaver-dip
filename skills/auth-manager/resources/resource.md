# 支持资源清单（Resource Types）

来源：`idrm-go-common/rest/authorization/enum.go`

## `resource_type` / Resource Type（资源类型）

- `data_view` / Data View（数据视图）
- `knowledge_network` / Knowledge Network（业务知识网络）
- `data_view_row_column_rule` / Data View Row-Column Rule（数据视图行列规则）

## 使用说明

- 申请权限（`/api/auth-service/v1/data-auth/apply`）和查询权限（`/api/auth-service/v1/data-resource/operations`）都必须使用上述枚举原值。
- `resource_type` 大小写必须与枚举一致，不可改写同义词。
- 不同 `resource_type` 仅可搭配其对应操作类型，详见 [`operations.md`](./operations.md)。
