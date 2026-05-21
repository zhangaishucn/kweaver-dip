# 申请人发现（自动补齐 `applicant_id`）

当申请权限时只给出用户名/账号（未给 `applicant_id`），先执行申请人发现，再继续授权申请。

## 适用场景

- 用户说“给张三开通某视图权限”，但未提供用户ID。
- 用户说“给账号 zhangsan 授权”，但只有登录账号。

## 发现规则（必须遵守）

1. 仅在**申请分支**使用；查询分支可直接省略 `subject` 走当前 token 用户。
2. 若缺 `applicant_id`，必须先执行申请人发现。
3. 单候选：自动回填 `applicant_id`，并补齐 `applicant_name`（若请求缺失）。
4. 多候选：列出候选（`id` + `name` + `account`）并让用户确认。
5. 零候选：停止后续申请，提示用户提供更精确账号或用户ID。
6. 若回填后 `applicant_id` 与当前用户 ID 一致，可直接继续申请；不一致时需做 applicant 存在性校验。
7. 若需求是“查全部用户”或“按部门筛选用户”，优先改走 [console-user-search.md](./console-user-search.md)。

## 优先接口：按账号精确匹配

接口：

- `GET /api/user-management/v1/account-match?account=<applicant_account>`

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/account-match?account=<applicant_account>' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例（命中）：

```json
{
  "result": true,
  "user": {
    "id": "2114a570-66a9-11eb-ad9d-0050568274c4",
    "account": "zhangsan",
    "auth_type": "local",
    "disable_status": false
  }
}
```

成功时响应通常为：

- `result=true`
- `user.id`（用户ID）
- `user.account`（账号）

## 兜底接口：按用户名模糊搜索

接口：

- `GET /api/user-management/v1/search-in-org-tree?keyword=<applicant_name>&type=user&role=<role>&offset=0&limit=20`

> 该接口要求 `role` 参数，取值如 `super_admin` / `normal_user`，并受调用方可见范围约束。

cURL 示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/search-in-org-tree?keyword=<applicant_name>&type=user&role=normal_user&offset=0&limit=20' \
  --header 'Authorization: Bearer <access_token>'
```

响应示例：

```json
{
  "users": {
    "entries": [
      {
        "id": "2114a570-66a9-11eb-ad9d-0050568274c4",
        "name": "张三",
        "account": "zhangsan",
        "type": "user",
        "parent_dep_paths": ["集团/销售中心/华东区"]
      }
    ],
    "total_count": 1
  },
  "departments": {
    "entries": [],
    "total_count": 0
  }
}
```

成功时可从 `users.entries[]` 提取：

- `id`
- `name`
- `account`

## 与主流程衔接

- 回填 `applicant_id` 后，按 [`auth-apply.md`](./auth-apply.md) 构造 `/api/auth-service/v1/data-auth/apply` 请求。
- `applicant_type` 仍需使用枚举原值（如 `user`），见 [`../resources/accessors.md`](../resources/accessors.md)。
- 若 `applicant_id` 与当前用户 ID 不一致，进入申请前需执行存在性校验：
  - `digital_employee`：`GET /api/dip-studio/v1/digital-human/{id}`
  - 其他类型：走 user-management / authorization 对应校验接口

