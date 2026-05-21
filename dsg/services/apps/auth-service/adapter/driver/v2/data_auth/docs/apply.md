# 数据视图权限审核

整体流程：
1. 通过固定的审核类型找到审核流程元数据详情
    1.1 没有审核流程就报错：提示去配置工作流
2. 通过审核流程元数据详情里面的ID，找到审核流程里面的审核详情，具体是第一个步
3. 通过审核流程里面的步骤，找到具体的title找到对应的字段，将结果塞入具体的字段
4. 调用运行接口运行


## 审核类型
data-view-auth-audit

## 审核流程元数据
返回结果的ID是想要的流程ID
```
GET
/api/automation/v1/dags?keyword=data-view-auth-audit&page=0&limit=50&sortby=updated_at&order=desc
response:
{
    "dags": [
        {
            "id": "616502025026315946",
            "title": "data-view-auth-audit",
            "description": "数据视图权限审核",
            "actions": [
                "@trigger/form",
                "@workflow/approval",
                "@internal/tool/py3"
            ],
            "created_at": 1776993442,
            "updated_at": 1777012900,
            "status": "normal",
            "userid": "5f88d1e0-3ebb-11f1-8993-261248b384b3",
            "creator": "liberly",
            "trigger": "form",
            "version_id": "616534671005623978"
        }
    ],
    "limit": 50,
    "page": 0,
    "total": 1
}
```


## 查找审核流程执行详情
上个步骤的id作为路径参数传入。
参数
```
GET /api/automation/v1/dag/{id}
response：
{
    "id": "616502025026315946",
    "title": "data-view-auth-audit",
    "description": "数据视图权限审核",
    "status": "normal",
    "steps": [
        {
            "id": "0",
            "title": "",
            "operator": "@trigger/form",
            "parameters": {
                "fields": [
                    {
                        "description": {
                            "text": "数据视图ID"
                        },
                        "key": "qjbleKnxVrOejLVL",
                        "name": "data_view_id",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "description": {
                            "text": "数据视图名称，为数据源名称+数据视图名称组合"
                        },
                        "key": "sJjfuElJnJpQbctU",
                        "name": "data_view_name",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "default": "user",
                        "description": {
                            "text": "申请人类型, 用户，部门，角色，应用"
                        },
                        "key": "ZGfCXUObSjvXEBII",
                        "name": "applicant_type",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "description": {
                            "text": "申请人ID"
                        },
                        "key": "YIJKMtvNexakntvB",
                        "name": "applicant_id",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "default": "",
                        "description": {
                            "text": "申请的操作,支持多个操作逗号拼接， view_detail, query_data"
                        },
                        "key": "qIbVYqQCGPMOLgnk",
                        "name": "operations",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "default": "2099-12-31T15:59:59.101Z",
                        "description": {
                            "text": "资源operation的有效期"
                        },
                        "key": "jJIdHyQYRlmOJCqT",
                        "name": "expiration",
                        "type": "datetime"
                    },
                    {
                        "description": {
                            "text": "申请人名称"
                        },
                        "key": "FBdGyqsdTIFYrplt",
                        "name": "applicant_name",
                        "required": true,
                        "type": "string"
                    },
                    {
                        "description": {
                            "text": "申请操作的名称，逗号分隔"
                        },
                        "key": "rcNItFEFnsAbxfZB",
                        "name": "operations_name",
                        "required": true,
                        "type": "string"
                    }
                ]
            }
        }
    ],
    "created_at": 1776993442,
    "updated_at": 1777016976,
    "shortcuts": null,
    "accessors": [
        {
            "id": "3bfff4c6-3e19-11f1-8fc1-261248b384b3",
            "type": "user",
            "name": "市大数据中心"
        },
        {
            "id": "151bcb65-48ce-4b62-973f-0bb6685f9cb8",
            "type": "user",
            "name": "组织结构"
        }
    ],
    "cron": "",
    "published": false,
    "trigger_config": {},
    "userid": "5f88d1e0-3ebb-11f1-8993-261248b384b3"
}
```


## 运行流程
body中的参数来自：steps[0].parameters.fields.key
```
POST /api/automation/v1/run-instance-form/616502025026315946
bodyq:
{
    "data": {
        "qjbleKnxVrOejLVL": "11111",
        "sJjfuElJnJpQbctU": "22222",
        "ZGfCXUObSjvXEBII": "user",
        "YIJKMtvNexakntvB": "22",
        "qIbVYqQCGPMOLgnk": "22222222",
        "jJIdHyQYRlmOJCqT": "2099-12-31T15:59:59.101Z",
        "FBdGyqsdTIFYrplt": "22222223",
        "rcNItFEFnsAbxfZB": "444444"
    }
}
```