# 申请人类型清单（Accessor Types）

来源：`idrm-go-common/rest/authorization/enum.go`

## `applicant_type` / `accessor_type`（申请人/访问者类型）

- `user` / User（用户）
- `department` / Department（部门）
- `group` / Group（用户组）
- `role` / Role（角色）
- `app` / App（应用）

## 使用说明

- 权限申请（`/api/auth-service/v1/data-auth/apply`）使用字段 `applicant_type`。
- 权限查询场景（访问者上下文）使用字段 `accessor_type`。
- 两者取值来自同一枚举，必须使用英文 code 原值，大小写严格匹配。
