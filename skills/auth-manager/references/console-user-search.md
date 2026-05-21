# 管理控制台用户搜索（全量 / 按部门）

用于在 user-management 中搜索用户，支持：

- 全量范围分页搜索（不传 `department_id`）
- 按部门分页搜索（传 `department_id`）
- 指定 `department_id=-1` 搜索“未分配组”

## 接口

- `GET /api/user-management/v1/console/search-users/{fields}`

## 参数规则（必须遵守）

### 必填参数

- `role`（query）：必须显式传递，且当前登录用户必须实际拥有该角色。
- `fields`（path）：返回字段集合，多个字段逗号分隔。

### 可选参数

- `department_id`：部门 ID；`-1` 表示未分配组；不传表示全量范围搜索。
- `code`：用户编码关键字。
- `name`：显示名关键字（**非必填**）。
- `account`：登录名关键字。
- `manager_name`：上级显示名关键字。
- `direct_department_code`：直属部门编码关键字。
- `position`：岗位关键字。
- `offset`：分页起始，默认 `0`，最小 `0`。
- `limit`：分页大小，默认 `20`，范围 `1..1000`。

## 角色与返回范围规则（重点）

1. **角色一致性校验**
   - 服务端会校验“当前 token 用户是否拥有 `role` 指定角色”。
   - 不满足时返回 `400`（`this user do not has this role`）。

2. **全量/未分配组搜索权限**
   - 当 `department_id` 缺失或为 `-1` 时，仅允许：
     - `super_admin`
     - `sys_admin`
     - `sec_admin`
     - `audit_admin`
   - 其他角色会返回 `403`（`this user has no authority`）。

3. **按部门搜索权限**
   - 当传入普通部门 ID（非 `-1`）时：
     - 先校验部门是否存在（不存在返回 `400`）。
     - 再校验该角色对该部门是否有可见范围（无权限返回 `403`）。

4. **结果结构**
   - 返回统一为：
     - `entries`：用户列表
     - `total_count`：总条数
   - `entries` 中具体字段由 `{fields}` 决定。

## 常用 `fields` 组合

- `account,name,parent_deps,roles`
- `account,name,code,manager,position,enabled`
- `account,name,remark,parent_deps,roles,csf_level,auth_type,priority,created_at,frozen`

## cURL 示例

### 1) 全量分页（不传 department_id，不传 name）

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/console/search-users/account,name,parent_deps,roles?role=super_admin&offset=0&limit=20' \
  --header 'Authorization: Bearer <access_token>'
```

### 2) 按部门查询

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/console/search-users/account,name,parent_deps,roles?department_id=<department_id>&role=org_manager&offset=0&limit=20' \
  --header 'Authorization: Bearer <access_token>'
```

### 3) 账号关键字模糊搜索

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/console/search-users/account,name,parent_deps?account=zhang&role=super_admin&offset=0&limit=20' \
  --header 'Authorization: Bearer <access_token>'
```

## 响应示例

```json
{
  "entries": [
    {
      "id": "2114a570-66a9-11eb-ad9d-0050568274c4",
      "type": "user",
      "account": "zhangsan",
      "name": "张三",
      "roles": ["normal_user"],
      "parent_deps": [
        [
          {
            "id": "151bcb65-48ce-4b62-973f-0bb6685f9cb8",
            "name": "组织结构",
            "type": "department"
          }
        ]
      ]
    }
  ],
  "total_count": 1
}
```

## 常见错误

| 场景 | HTTP | 典型错误 |
|------|------|----------|
| 缺失或非法 `role` | 400 | `invalid role` |
| 当前用户不具备传入角色 | 400 | `this user do not has this role` |
| `offset` / `limit` 非法 | 400 | `invalid offset type` / `invalid limit type` |
| 指定部门不存在 | 400 | `this department not exist` |
| 角色无该部门范围权限 | 403 | `this user do not has this authority` |
| 非高权限角色做全量搜索 | 403 | `this user has no authority` |

