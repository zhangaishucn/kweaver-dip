# 用户组查询

用于按关键词分页查询用户组。

## 接口

- `GET /api/user-management/v1/management/groups?offset=<offset>&limit=<limit>&keyword=<keyword>`

示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/management/groups?offset=0&limit=50&keyword=%E6%B5%8B' \
  --header 'Authorization: Bearer <access_token>'
```

## 响应示例

```json
{
  "entries": [
    {
      "id": "36e274cc-58e3-4c7d-97d3-615f1396ab94",
      "name": "测试",
      "notes": ""
    }
  ],
  "total_count": 1
}
```
