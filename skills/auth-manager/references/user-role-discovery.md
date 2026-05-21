# 用户角色查询（独立）

> 来源：`@isf` 的 user-management 路由与实现。

用于两类常见场景：

- 已知用户 ID，查询用户拥有哪些角色
- 已知角色，反查角色成员用户

## 接口 1：按用户查询角色

- 方法：`GET`
- 路径：`/api/user-management/v1/users/{user_ids}/{fields}`
- 用途：在调用者可见范围内，按用户 ID 查询用户信息；当 `fields` 包含 `roles` 时返回角色列表。

### 参数规则

- `user_ids`（path，必填）：用户 ID，多个用逗号分隔。
- `fields`（path，必填）：返回字段列表，多个用逗号分隔；查询角色时需包含 `roles`。
- `role`（query，必填）：调用上下文角色，服务端会校验当前 token 用户是否拥有该角色。

### cURL 示例

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/users/2114a570-66a9-11eb-ad9d-0050568274c4/roles,name,account?role=super_admin' \
  --header 'Authorization: Bearer <access_token>'
```

### 响应示例

```json
[
  {
    "id": "2114a570-66a9-11eb-ad9d-0050568274c4",
    "type": "user",
    "name": "张三",
    "account": "zhangsan",
    "roles": ["normal_user", "org_manager"]
  }
]
```

## 接口 2：按角色查询成员

- 方法：`GET`
- 路径：`/api/user-management/v1/role-members/{roles}`
- 用途：根据角色名查询角色成员列表（返回 `id` + `type=user`）。

### 参数规则

- `roles`（path，必填）：角色名，多个用逗号分隔。
- 支持角色：`super_admin`、`sys_admin`、`audit_admin`、`sec_admin`、`org_manager`、`org_audit`。

### cURL 示例

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/role-members/super_admin,sys_admin' \
  --header 'Authorization: Bearer <access_token>'
```

### 响应示例

```json
[
  {
    "role": "super_admin",
    "members": [
      { "id": "5f88d1e0-3ebb-11f1-8993-261248b384b3", "type": "user" }
    ]
  },
  {
    "role": "sys_admin",
    "members": [
      { "id": "21661ae6-421f-11f1-8993-261248b384b3", "type": "user" }
    ]
  }
]
```

## 使用规则（必须遵守）

1. 所有请求必须携带 `Authorization: Bearer <access_token>`。
2. 查询用户角色（接口 1）时，`role` 为必填且会被服务端校验；缺失或非法会返回 `400`。
3. 角色成员反查（接口 2）时，`roles` 仅允许固定枚举；非法角色会返回 `400 invalid role`。
4. 角色名需使用英文 code 原值，禁止同义词或中文值。
5. 接口失败时按全局约束执行“最多重试 1 次”，重试后仍失败则返回原始错误。

## 常见错误

| 场景 | HTTP | 典型错误 |
|------|------|----------|
| 缺失 `role`（接口 1） | 400 | `invalid type`（`params: role`） |
| 当前用户不具备传入 `role`（接口 1） | 400 | `this user do not has this role` |
| 角色名非法（接口 2） | 400 | `invalid role` |
| 鉴权失败 | 401/403 | `Unauthorized` / 权限不足 |
