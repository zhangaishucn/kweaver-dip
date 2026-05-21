# 用户组成员查询

用于分页查询指定用户组下的成员列表。

## 接口

- `GET /api/user-management/v1/management/group-members/{group_id}?offset=<offset>&limit=<limit>`

示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/management/group-members/36e274cc-58e3-4c7d-97d3-615f1396ab94?offset=0&limit=50' \
  --header 'Authorization: Bearer <access_token>'
```

## 响应示例

```json
{
  "total_count": 2,
  "entries": [
    {
      "name": "q",
      "department_names": [
        "组织结构"
      ],
      "parent_deps": [
        [
          {
            "name": "组织结构",
            "type": "department",
            "id": "151bcb65-48ce-4b62-973f-0bb6685f9cb8"
          }
        ]
      ],
      "id": "21661ae6-421f-11f1-8993-261248b384b3",
      "type": "user"
    },
    {
      "parent_deps": [
        [
          {
            "id": "151bcb65-48ce-4b62-973f-0bb6685f9cb8",
            "name": "组织结构",
            "type": "department"
          }
        ]
      ],
      "id": "5f88d1e0-3ebb-11f1-8993-261248b384b3",
      "type": "user",
      "name": "liberly",
      "department_names": [
        "组织结构"
      ]
    }
  ]
}
```
