# 应用账户查询

用于分页查询应用账户列表。

## 接口

- `GET /api/user-management/v1/apps?limit=<limit>&offset=<offset>&direction=<direction>&sort=<sort>&keyword=<keyword>`

示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/apps?limit=50&offset=0&direction=desc&sort=date_created&keyword=' \
  --header 'Authorization: Bearer <access_token>'
```

## 响应示例

```json
{
  "entries": [
    {
      "name": "openclaw",
      "credential_type": "token",
      "id": "f0a4dfef-7bc2-442b-b71f-b9292cb86b9e"
    },
    {
      "id": "92abbf11-a3e2-43c9-a79b-9529589a686d",
      "name": "t1",
      "credential_type": "token"
    }
  ],
  "total_count": 2
}
```
