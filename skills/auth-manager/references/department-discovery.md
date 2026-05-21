# 部门查询

用于查询指定成员可见的部门列表。

## 接口

- `GET /api/user-management/v1/management/department-members/{member_id}/departments?role=<role>&offset=<offset>&limit=<limit>`

示例：

```bash
curl --location --request GET 'http://127.0.0.1:8155/api/user-management/v1/management/department-members/00000000-0000-0000-0000-000000000000/departments?role=super_admin&offset=0&limit=100' \
  --header 'Authorization: Bearer <access_token>'
```

## 响应示例

```json
{
  "departments": {
    "total_count": 2,
    "entries": [
      {
        "type": "department",
        "is_root": true,
        "email": "",
        "remark": "",
        "code": "",
        "name": "市大数据中心",
        "depart_existed": true,
        "enabled": true,
        "parent_deps": [],
        "id": "3bfff4c6-3e19-11f1-8fc1-261248b384b3"
      },
      {
        "id": "151bcb65-48ce-4b62-973f-0bb6685f9cb8",
        "type": "department",
        "is_root": true,
        "depart_existed": false,
        "remark": "",
        "code": "",
        "name": "组织结构",
        "email": "",
        "enabled": true,
        "parent_deps": []
      }
    ]
  }
}
```
