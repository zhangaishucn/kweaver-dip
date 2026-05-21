# 资源操作清单（Resource Operations）

来源：`idrm-go-common/rest/authorization/enum.go`

## `auth_operations` for `data_view`（数据视图操作）

- `data_query` / Data Query（数据查询）
- `view_detail` / View Detail（查看）
- `modify` / Modify（修改）
- `delete` / Delete（删除）
- `create` / Create（新建）
- `authorize` / Authorize（权限管理）
- `import` / Import（导入）
- `export` / Export（导出）
- `rule_manage` / Rule Management（行列规则管理）
- `rule_authorize` / Rule Authorization（行列规则授权）

## `auth_operations` for `knowledge_network`（业务知识网络操作）

- `view_detail` / View Detail（查看）
- `create` / Create（新建）
- `modify` / Modify（编辑）
- `delete` / Delete（删除）
- `data_query` / Data Query（数据查询）
- `authorize` / Authorize（权限管理）
- `import` / Import（导入）
- `export` / Export（导出）
- `task_manage` / Task Management（任务管理）

## `auth_operations` for `data_view_row_column_rule`（行列规则操作）

- `rule_apply` / Rule Apply（规则应用）

## 使用说明

- `auth_operations` 必须与 `resource_type` 匹配，不得跨资源类型混用。
- 权限申请与权限查询均使用本清单中的枚举原值（英文 code）。
