use kweaver;

INSERT INTO kweaver.t_flow_dag
(f_id, f_created_at, f_updated_at, f_user_id, f_name, f_desc, f_trigger, f_cron, f_vars, f_status, f_tasks, f_steps, f_description, f_shortcuts, f_accessors, f_type, f_policy_type, f_appinfo, f_priority, f_removed, f_emails, f_template, f_published, f_trigger_config, f_sub_ids, f_exec_mode, f_category, f_outputs, f_instructions, f_operator_id, f_inc_values, f_version, f_version_id, f_modify_by, f_is_debug, f_debug_id, f_biz_domain_id)
select
  616502025026315947,1776993442, 1777443621,'266c6a42-6131-4d62-8f39-853e7093701c','data-view-auth-audit','','form', '','{"docid":{},"userid":{"defaultValue":"266c6a42-6131-4d62-8f39-853e7093701c"}}','normal',
  '[{"id":"0","actionName":"@trigger/form","timeoutSecs":660,"params":{"fields":[{"description":{"text":"数据视图ID"},"key":"qjbleKnxVrOejLVL","name":"data_view_id","required":true,"type":"string"},{"description":{"text":"数据视图名称，为数据源名称+数据视图名称组合"},"key":"sJjfuElJnJpQbctU","name":"data_view_name","required":true,"type":"string"},{"default":"user","description":{"text":"申请人类型, 用户，部门，角色，应用"},"key":"ZGfCXUObSjvXEBII","name":"applicant_type","required":true,"type":"string"},{"description":{"text":"申请人ID"},"key":"YIJKMtvNexakntvB","name":"applicant_id","required":true,"type":"string"},{"default":"","description":{"text":"申请的操作,支持多个操作逗号拼接， view_detail, query_data"},"key":"qIbVYqQCGPMOLgnk","name":"operations","required":true,"type":"string"},{"default":"2099-12-31 23:59:59","description":{"text":"资源operation的有效期"},"key":"jJIdHyQYRlmOJCqT","name":"expiration","type":"string"},{"description":{"text":"申请人名称"},"key":"FBdGyqsdTIFYrplt","name":"applicant_name","required":true,"type":"string"},{"description":{"text":"申请操作的名称，逗号分隔"},"key":"rcNItFEFnsAbxfZB","name":"operations_name","required":true,"type":"string"},{"description":{"text":"数据源名称"},"key":"fUJOHHfzxdtAQMRt","name":"datasource_name","required":true,"type":"string"}]}},{"id":"1","dependOn":["0"],"actionName":"@workflow/approval","timeoutSecs":10000000060,"params":{"contents":[{"title":"申请人","type":"string","value":"{{__0.fields.FBdGyqsdTIFYrplt}}"},{"allowModifyByAuditor":false,"title":"申请人类型","type":"string","value":"{{__0.fields.ZGfCXUObSjvXEBII}}"},{"title":"数据视图","type":"string","value":"{{__0.fields.sJjfuElJnJpQbctU}}"},{"title":"数据源名称","type":"string","value":"{{__0.fields.fUJOHHfzxdtAQMRt}}"},{"allowModifyByAuditor":false,"title":"申请操作","type":"string","value":"{{__0.fields.rcNItFEFnsAbxfZB}}"},{"allowModifyByAuditor":true,"title":"过期时间","type":"string","value":"{{__0.fields.jJIdHyQYRlmOJCqT}}"},{"title":"过期时间格式","type":"string","value":"2006-01-02 15:04:05"}],"title":"数据视图权限申请","workflow":"Process_BMXpWT4a"}},{"id":"1001","dependOn":["1"],"actionName":"@internal/tool/py3","timeoutSecs":86460,"params":{"code":"from datetime import datetime, timedelta, timezone\\nimport requests\\nfrom aishu_anyshare_api import ApiClient\\nimport logging\\nfrom urllib.parse import urljoin\\nfrom collections.abc import Mapping\\n\\n\\ndef main(data_view_id,applicant_id, applicant_type, operations, expiration,data_view_name):\\n    host = ApiClient.get_global_host()\\n    token = ApiClient.get_global_access_token()\\n\\n    # host 可能形如 \\"192.168.40.63:443\\" / \\"https://192.168.40.63:443/\\" / \\"://192.168.40.63:443/\\"\\n    if isinstance(host, str) and host.startswith(\\"http\\"):\\n        base = host\\n    elif isinstance(host, str) and host.startswith(\\"://\\"):\\n        base = f\\"https{host}\\"\\n    else:\\n        base = f\\"https://{host}\\"\\n    if not base.endswith(\\"/\\"):\\n        base += \\"/\\"\\n    base_url = urljoin(base, \\"api/authorization/v1/policy\\")\\n    \\n\\n    # operations 可能是 \\"a,b,c\\" 或 list；同时可能包含空格/空项\\n    if isinstance(operations, str):\\n        operation_list = [op.strip() for op in operations.split(\\",\\") if op.strip()]\\n    else:\\n        operation_list = [str(op).strip() for op in (operations or []) if str(op).strip()]\\n    \\n    if expiration == \\"永不过期\\":\\n        expires_at = \\"1970-01-01T08:00:00+08:00\\"\\n    else:\\n        # input_params[\\"expiration\\"] 是北京时间字符串（如 2099-12-31 23:59:59），转换为 RFC3339\\n        expires_at = datetime.strptime(expiration, \\"%Y-%m-%d %H:%M:%S\\").replace(\\n            tzinfo=timezone(timedelta(hours=8))\\n        ).isoformat()\\n        \\n\\n    # 2. 给用户授权（使用字典结构）\\n    arg =[ {\\n        \\"accessor\\": {\\n            \\"id\\": applicant_id,\\n            \\"type\\": applicant_type,\\n        },\\n        \\"resource\\": {\\n            \\"id\\": data_view_id,\\n            \\"name\\": data_view_name,\\n            \\"type\\": \\"data_view\\",\\n        },\\n        \\"operation\\": {\\n            \\"allow\\": [{\\"id\\": op} for op in operation_list],\\n            \\"deny\\": [],\\n        },\\n        \\"expires_at\\": expires_at,\\n    }]\\n\\n    logging.info(arg)\\n    headers = { \\n        \\"Content-Type\\": \\"application/json\\",\\n        \\"Authorization\\": f\\"Bearer {token}\\",\\n    }\\n    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)\\n    try:\\n        resp.raise_for_status()\\n    except requests.HTTPError as e:\\n        # 把后端返回的具体报错信息带出来（400 时非常关键）\\n        return f\\"fail: {e}; body={resp.text}\\"\\n\\n    payload = resp.json() if resp.content else {}\\n    ids = payload.get(\\"ids\\") if isinstance(payload, Mapping) else None\\n    if not ids:\\n        return f\\"fail: unexpected response body={payload}\\"\\n    return \\"success\\"","input_params":[{"id":"m7vqt","key":"data_view_id","type":"string","value":"{{__0.fields.qjbleKnxVrOejLVL}}"},{"id":"jkbyo","key":"applicant_id","type":"string","value":"{{__0.fields.YIJKMtvNexakntvB}}"},{"id":"2scz2","key":"applicant_type","type":"string","value":"{{__0.fields.ZGfCXUObSjvXEBII}}"},{"id":"y4vys","key":"operations","type":"string","value":"{{__0.fields.qIbVYqQCGPMOLgnk}}"},{"id":"0llkx","key":"expiration","type":"string","value":"{{__0.fields.jJIdHyQYRlmOJCqT}}"},{"id":"izrjz","key":"data_view_name","type":"string","value":"{{__0.fields.sJjfuElJnJpQbctU}}"}],"output_params":[{"id":"ehmj4","key":"status","type":"string"}]}}]',
  '[{"id":"0","title":"","operator":"@trigger/form","parameters":{"fields":[{"description":{"text":"数据视图ID"},"key":"qjbleKnxVrOejLVL","name":"data_view_id","required":true,"type":"string"},{"description":{"text":"数据视图名称，为数据源名称+数据视图名称组合"},"key":"sJjfuElJnJpQbctU","name":"data_view_name","required":true,"type":"string"},{"default":"user","description":{"text":"申请人类型, 用户，部门，角色，应用"},"key":"ZGfCXUObSjvXEBII","name":"applicant_type","required":true,"type":"string"},{"description":{"text":"申请人ID"},"key":"YIJKMtvNexakntvB","name":"applicant_id","required":true,"type":"string"},{"default":"","description":{"text":"申请的操作,支持多个操作逗号拼接， view_detail, query_data"},"key":"qIbVYqQCGPMOLgnk","name":"operations","required":true,"type":"string"},{"default":"2099-12-31 23:59:59","description":{"text":"资源operation的有效期"},"key":"jJIdHyQYRlmOJCqT","name":"expiration","type":"string"},{"description":{"text":"申请人名称"},"key":"FBdGyqsdTIFYrplt","name":"applicant_name","required":true,"type":"string"},{"description":{"text":"申请操作的名称，逗号分隔"},"key":"rcNItFEFnsAbxfZB","name":"operations_name","required":true,"type":"string"},{"description":{"text":"数据源名称"},"key":"fUJOHHfzxdtAQMRt","name":"datasource_name","required":true,"type":"string"}]}},{"id":"1","title":"","operator":"@workflow/approval","parameters":{"contents":[{"title":"申请人","type":"string","value":"{{__0.fields.FBdGyqsdTIFYrplt}}"},{"allowModifyByAuditor":false,"title":"申请人类型","type":"string","value":"{{__0.fields.ZGfCXUObSjvXEBII}}"},{"title":"数据视图","type":"string","value":"{{__0.fields.sJjfuElJnJpQbctU}}"},{"title":"数据源名称","type":"string","value":"{{__0.fields.fUJOHHfzxdtAQMRt}}"},{"allowModifyByAuditor":false,"title":"申请操作","type":"string","value":"{{__0.fields.rcNItFEFnsAbxfZB}}"},{"allowModifyByAuditor":true,"title":"过期时间","type":"string","value":"{{__0.fields.jJIdHyQYRlmOJCqT}}"},{"title":"过期时间格式","type":"string","value":"2006-01-02 15:04:05"}],"title":"数据视图权限申请","workflow":"Process_BMXpWT4a"}},{"id":"1001","title":"","operator":"@internal/tool/py3","parameters":{"code":"from datetime import datetime, timedelta, timezone\\nimport requests\\nfrom aishu_anyshare_api import ApiClient\\nimport logging\\nfrom urllib.parse import urljoin\\nfrom collections.abc import Mapping\\n\\n\\ndef main(data_view_id,applicant_id, applicant_type, operations, expiration,data_view_name):\\n    host = ApiClient.get_global_host()\\n    token = ApiClient.get_global_access_token()\\n\\n    # host 可能形如 \\"192.168.40.63:443\\" / \\"https://192.168.40.63:443/\\" / \\"://192.168.40.63:443/\\"\\n    if isinstance(host, str) and host.startswith(\\"http\\"):\\n        base = host\\n    elif isinstance(host, str) and host.startswith(\\"://\\"):\\n        base = f\\"https{host}\\"\\n    else:\\n        base = f\\"https://{host}\\"\\n    if not base.endswith(\\"/\\"):\\n        base += \\"/\\"\\n    base_url = urljoin(base, \\"api/authorization/v1/policy\\")\\n    \\n\\n    # operations 可能是 \\"a,b,c\\" 或 list；同时可能包含空格/空项\\n    if isinstance(operations, str):\\n        operation_list = [op.strip() for op in operations.split(\\",\\") if op.strip()]\\n    else:\\n        operation_list = [str(op).strip() for op in (operations or []) if str(op).strip()]\\n    \\n    if expiration == \\"永不过期\\":\\n        expires_at = \\"1970-01-01T08:00:00+08:00\\"\\n    else:\\n        # input_params[\\"expiration\\"] 是北京时间字符串（如 2099-12-31 23:59:59），转换为 RFC3339\\n        expires_at = datetime.strptime(expiration, \\"%Y-%m-%d %H:%M:%S\\").replace(\\n            tzinfo=timezone(timedelta(hours=8))\\n        ).isoformat()\\n        \\n\\n    # 2. 给用户授权（使用字典结构）\\n    arg =[ {\\n        \\"accessor\\": {\\n            \\"id\\": applicant_id,\\n            \\"type\\": applicant_type,\\n        },\\n        \\"resource\\": {\\n            \\"id\\": data_view_id,\\n            \\"name\\": data_view_name,\\n            \\"type\\": \\"data_view\\",\\n        },\\n        \\"operation\\": {\\n            \\"allow\\": [{\\"id\\": op} for op in operation_list],\\n            \\"deny\\": [],\\n        },\\n        \\"expires_at\\": expires_at,\\n    }]\\n\\n    logging.info(arg)\\n    headers = { \\n        \\"Content-Type\\": \\"application/json\\",\\n        \\"Authorization\\": f\\"Bearer {token}\\",\\n    }\\n    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)\\n    try:\\n        resp.raise_for_status()\\n    except requests.HTTPError as e:\\n        # 把后端返回的具体报错信息带出来（400 时非常关键）\\n        return f\\"fail: {e}; body={resp.text}\\"\\n\\n    payload = resp.json() if resp.content else {}\\n    ids = payload.get(\\"ids\\") if isinstance(payload, Mapping) else None\\n    if not ids:\\n        return f\\"fail: unexpected response body={payload}\\"\\n    return \\"success\\"","input_params":[{"id":"m7vqt","key":"data_view_id","type":"string","value":"{{__0.fields.qjbleKnxVrOejLVL}}"},{"id":"jkbyo","key":"applicant_id","type":"string","value":"{{__0.fields.YIJKMtvNexakntvB}}"},{"id":"2scz2","key":"applicant_type","type":"string","value":"{{__0.fields.ZGfCXUObSjvXEBII}}"},{"id":"y4vys","key":"operations","type":"string","value":"{{__0.fields.qIbVYqQCGPMOLgnk}}"},{"id":"0llkx","key":"expiration","type":"string","value":"{{__0.fields.jJIdHyQYRlmOJCqT}}"},{"id":"izrjz","key":"data_view_name","type":"string","value":"{{__0.fields.sJjfuElJnJpQbctU}}"}],"output_params":[{"id":"ehmj4","key":"status","type":"string"}]}}]',
  '数据视图权限审核','null','[{"id":"266c6a42-6131-4d62-8f39-853e7093701c","type":"user","name":"liberly"}]','','','{}','lowest',0,'null','',0,'{}','null','','','null','null','','null','v0.0.2','617257301450991327','266c6a42-6131-4d62-8f39-853e7093701c',0,'','bd_public'
from DUAL where not exists (select f_id from kweaver.t_flow_dag where f_id = 616502025026315947);


INSERT INTO kweaver.t_flow_dag_version
(f_id, f_created_at, f_updated_at, f_dag_id, f_user_id, f_version, f_version_id, f_change_log, f_config, f_sort_time)
select 616982011965384363, 1777279537, 1777279536, '616502025026315947', '266c6a42-6131-4d62-8f39-853e7093701c', 'v0.0.1', '616982011965384363', '', '{
  "id": "616502025026315947",
  "createdAt": 1776993442,
  "updatedAt": 1777278965,
  "userid": "266c6a42-6131-4d62-8f39-853e7093701c",
  "name": "data-view-auth-audit",
  "trigger": "form",
  "vars": {
    "docid": {},
    "userid": {
      "defaultValue": "266c6a42-6131-4d62-8f39-853e7093701c"
    }
  },
  "status": "normal",
  "tasks": [
    {
      "id": "0",
      "actionName": "@trigger/form",
      "timeoutSecs": 660,
      "params": {
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
            "default": "2099-12-31 23:59:59",
            "description": {
              "text": "资源operation的有效期"
            },
            "key": "jJIdHyQYRlmOJCqT",
            "name": "expiration",
            "type": "string"
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
          },
          {
            "description": {
              "text": "数据源名称"
            },
            "key": "fUJOHHfzxdtAQMRt",
            "name": "datasource_name",
            "required": true,
            "type": "string"
          }
        ]
      }
    },
    {
      "id": "1",
      "dependOn": [
        "0"
      ],
      "actionName": "@workflow/approval",
      "timeoutSecs": 10000000060,
      "params": {
        "contents": [
          {
            "title": "申请人",
            "type": "string",
            "value": "{{__0.fields.FBdGyqsdTIFYrplt}}"
          },
          {
            "allowModifyByAuditor": false,
            "title": "申请人类型",
            "type": "string",
            "value": "{{__0.fields.ZGfCXUObSjvXEBII}}"
          },
          {
            "title": "数据视图",
            "type": "string",
            "value": "{{__0.fields.sJjfuElJnJpQbctU}}"
          },
          {
            "title": "数据源名称",
            "type": "string",
            "value": "{{__0.fields.fUJOHHfzxdtAQMRt}}"
          },
          {
            "allowModifyByAuditor": false,
            "title": "申请操作",
            "type": "string",
            "value": "{{__0.fields.rcNItFEFnsAbxfZB}}"
          },
          {
            "allowModifyByAuditor": true,
            "title": "过期时间",
            "type": "string",
            "value": "{{__0.fields.jJIdHyQYRlmOJCqT}}"
          },
          {
            "title": "过期时间格式",
            "type": "string",
            "value": "2006-01-02 15:04:05"
          }
        ],
        "title": "数据视图权限申请",
        "workflow": "Process_BMXpWT4a"
      }
    },
    {
      "id": "1001",
      "dependOn": [
        "1"
      ],
      "actionName": "@internal/tool/py3",
      "timeoutSecs": 86460,
      "params": {
        "code": "from datetime import datetime, timedelta, timezone\\nimport requests\\nfrom aishu_anyshare_api import ApiClient\\nimport logging\\nfrom urllib.parse import urljoin\\nfrom collections.abc import Mapping\\n\\n\\ndef main(data_view_id,applicant_id, applicant_type, operations, expiration,data_view_name):\\n    host = ApiClient.get_global_host()\\n    token = ApiClient.get_global_access_token()\\n\\n    # host 可能形如 \\"192.168.40.63:443\\" / \\"https://192.168.40.63:443/\\" / \\"://192.168.40.63:443/\\"\\n    if isinstance(host, str) and host.startswith(\\"http\\"):\\n        base = host\\n    elif isinstance(host, str) and host.startswith(\\"://\\"):\\n        base = f\\"https{host}\\"\\n    else:\\n        base = f\\"https://{host}\\"\\n    if not base.endswith(\\"/\\"):\\n        base += \\"/\\"\\n    base_url = urljoin(base, \\"api/authorization/v1/policy\\")\\n    \\n\\n    # operations 可能是 \\"a,b,c\\" 或 list；同时可能包含空格/空项\\n    if isinstance(operations, str):\\n        operation_list = [op.strip() for op in operations.split(\\",\\") if op.strip()]\\n    else:\\n        operation_list = [str(op).strip() for op in (operations or []) if str(op).strip()]\\n    \\n    if expiration == \\"永不过期\\":\\n        expires_at = \\"1970-01-01T08:00:00+08:00\\"\\n    else:\\n        # input_params[\\"expiration\\"] 是北京时间字符串（如 2099-12-31 23:59:59），转换为 RFC3339\\n        expires_at = datetime.strptime(expiration, \\"%Y-%m-%d %H:%M:%S\\").replace(\\n            tzinfo=timezone(timedelta(hours=8))\\n        ).isoformat()\\n        \\n\\n    # 2. 给用户授权（使用字典结构）\\n    arg =[ {\\n        \\"accessor\\": {\\n            \\"id\\": applicant_id,\\n            \\"type\\": applicant_type,\\n        },\\n        \\"resource\\": {\\n            \\"id\\": data_view_id,\\n            \\"name\\": data_view_name,\\n            \\"type\\": \\"data_view\\",\\n        },\\n        \\"operation\\": {\\n            \\"allow\\": [{\\"id\\": op} for op in operation_list],\\n            \\"deny\\": [],\\n        },\\n        \\"expires_at\\": expires_at,\\n    }]\\n\\n    logging.info(arg)\\n    headers = { \\n        \\"Content-Type\\": \\"application/json\\",\\n        \\"Authorization\\": f\\"Bearer {token}\\",\\n    }\\n    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)\\n    try:\\n        resp.raise_for_status()\\n    except requests.HTTPError as e:\\n        # 把后端返回的具体报错信息带出来（400 时非常关键）\\n        return f\\"fail: {e}; body={resp.text}\\"\\n\\n    payload = resp.json() if resp.content else {}\\n    ids = payload.get(\\"ids\\") if isinstance(payload, Mapping) else None\\n    if not ids:\\n        return f\\"fail: unexpected response body={payload}\\"\\n    return \\"success\\"",
        "input_params": [
          {
            "id": "m7vqt",
            "key": "data_view_id",
            "type": "string",
            "value": "{{__0.fields.qjbleKnxVrOejLVL}}"
          },
          {
            "id": "jkbyo",
            "key": "applicant_id",
            "type": "string",
            "value": "{{__0.fields.YIJKMtvNexakntvB}}"
          },
          {
            "id": "2scz2",
            "key": "applicant_type",
            "type": "string",
            "value": "{{__0.fields.ZGfCXUObSjvXEBII}}"
          },
          {
            "id": "y4vys",
            "key": "operations",
            "type": "string",
            "value": "{{__0.fields.qIbVYqQCGPMOLgnk}}"
          },
          {
            "id": "0llkx",
            "key": "expiration",
            "type": "string",
            "value": "{{__0.fields.jJIdHyQYRlmOJCqT}}"
          },
          {
            "id": "izrjz",
            "key": "data_view_name",
            "type": "string",
            "value": "{{__0.fields.sJjfuElJnJpQbctU}}"
          }
        ],
        "output_params": [
          {
            "id": "ehmj4",
            "key": "status",
            "type": "string"
          }
        ]
      }
    }
  ],
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
            "default": "2099-12-31 23:59:59",
            "description": {
              "text": "资源operation的有效期"
            },
            "key": "jJIdHyQYRlmOJCqT",
            "name": "expiration",
            "type": "string"
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
          },
          {
            "description": {
              "text": "数据源名称"
            },
            "key": "fUJOHHfzxdtAQMRt",
            "name": "datasource_name",
            "required": true,
            "type": "string"
          }
        ]
      }
    },
    {
      "id": "1",
      "title": "",
      "operator": "@workflow/approval",
      "parameters": {
        "contents": [
          {
            "title": "申请人",
            "type": "string",
            "value": "{{__0.fields.FBdGyqsdTIFYrplt}}"
          },
          {
            "allowModifyByAuditor": false,
            "title": "申请人类型",
            "type": "string",
            "value": "{{__0.fields.ZGfCXUObSjvXEBII}}"
          },
          {
            "title": "数据视图",
            "type": "string",
            "value": "{{__0.fields.sJjfuElJnJpQbctU}}"
          },
          {
            "title": "数据源名称",
            "type": "string",
            "value": "{{__0.fields.fUJOHHfzxdtAQMRt}}"
          },
          {
            "allowModifyByAuditor": false,
            "title": "申请操作",
            "type": "string",
            "value": "{{__0.fields.rcNItFEFnsAbxfZB}}"
          },
          {
            "allowModifyByAuditor": true,
            "title": "过期时间",
            "type": "string",
            "value": "{{__0.fields.jJIdHyQYRlmOJCqT}}"
          },
          {
            "title": "过期时间格式",
            "type": "string",
            "value": "2006-01-02 15:04:05"
          }
        ],
        "title": "数据视图权限申请",
        "workflow": "Process_BMXpWT4a"
      }
    },
    {
      "id": "1001",
      "title": "",
      "operator": "@internal/tool/py3",
      "parameters": {
        "code": "from datetime import datetime, timedelta, timezone\\nimport requests\\nfrom aishu_anyshare_api import ApiClient\\nimport logging\\nfrom urllib.parse import urljoin\\nfrom collections.abc import Mapping\\n\\n\\ndef main(data_view_id,applicant_id, applicant_type, operations, expiration,data_view_name):\\n    host = ApiClient.get_global_host()\\n    token = ApiClient.get_global_access_token()\\n\\n    # host 可能形如 \\"192.168.40.63:443\\" / \\"https://192.168.40.63:443/\\" / \\"://192.168.40.63:443/\\"\\n    if isinstance(host, str) and host.startswith(\\"http\\"):\\n        base = host\\n    elif isinstance(host, str) and host.startswith(\\"://\\"):\\n        base = f\\"https{host}\\"\\n    else:\\n        base = f\\"https://{host}\\"\\n    if not base.endswith(\\"/\\"):\\n        base += \\"/\\"\\n    base_url = urljoin(base, \\"api/authorization/v1/policy\\")\\n    \\n\\n    # operations 可能是 \\"a,b,c\\" 或 list；同时可能包含空格/空项\\n    if isinstance(operations, str):\\n        operation_list = [op.strip() for op in operations.split(\\",\\") if op.strip()]\\n    else:\\n        operation_list = [str(op).strip() for op in (operations or []) if str(op).strip()]\\n    \\n    if expiration == \\"永不过期\\":\\n        expires_at = \\"1970-01-01T08:00:00+08:00\\"\\n    else:\\n        # input_params[\\"expiration\\"] 是北京时间字符串（如 2099-12-31 23:59:59），转换为 RFC3339\\n        expires_at = datetime.strptime(expiration, \\"%Y-%m-%d %H:%M:%S\\").replace(\\n            tzinfo=timezone(timedelta(hours=8))\\n        ).isoformat()\\n        \\n\\n    # 2. 给用户授权（使用字典结构）\\n    arg =[ {\\n        \\"accessor\\": {\\n            \\"id\\": applicant_id,\\n            \\"type\\": applicant_type,\\n        },\\n        \\"resource\\": {\\n            \\"id\\": data_view_id,\\n            \\"name\\": data_view_name,\\n            \\"type\\": \\"data_view\\",\\n        },\\n        \\"operation\\": {\\n            \\"allow\\": [{\\"id\\": op} for op in operation_list],\\n            \\"deny\\": [],\\n        },\\n        \\"expires_at\\": expires_at,\\n    }]\\n\\n    logging.info(arg)\\n    headers = { \\n        \\"Content-Type\\": \\"application/json\\",\\n        \\"Authorization\\": f\\"Bearer {token}\\",\\n    }\\n    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)\\n    try:\\n        resp.raise_for_status()\\n    except requests.HTTPError as e:\\n        # 把后端返回的具体报错信息带出来（400 时非常关键）\\n        return f\\"fail: {e}; body={resp.text}\\"\\n\\n    payload = resp.json() if resp.content else {}\\n    ids = payload.get(\\"ids\\") if isinstance(payload, Mapping) else None\\n    if not ids:\\n        return f\\"fail: unexpected response body={payload}\\"\\n    return \\"success\\"",
        "input_params": [
          {
            "id": "m7vqt",
            "key": "data_view_id",
            "type": "string",
            "value": "{{__0.fields.qjbleKnxVrOejLVL}}"
          },
          {
            "id": "jkbyo",
            "key": "applicant_id",
            "type": "string",
            "value": "{{__0.fields.YIJKMtvNexakntvB}}"
          },
          {
            "id": "2scz2",
            "key": "applicant_type",
            "type": "string",
            "value": "{{__0.fields.ZGfCXUObSjvXEBII}}"
          },
          {
            "id": "y4vys",
            "key": "operations",
            "type": "string",
            "value": "{{__0.fields.qIbVYqQCGPMOLgnk}}"
          },
          {
            "id": "0llkx",
            "key": "expiration",
            "type": "string",
            "value": "{{__0.fields.jJIdHyQYRlmOJCqT}}"
          },
          {
            "id": "izrjz",
            "key": "data_view_name",
            "type": "string",
            "value": "{{__0.fields.sJjfuElJnJpQbctU}}"
          }
        ],
        "output_params": [
          {
            "id": "ehmj4",
            "key": "status",
            "type": "string"
          }
        ]
      }
    }
  ],
  "description": "数据视图权限审核",
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
  "appinfo": {},
  "priority": "lowest",
  "trigger_config": {},
  "version": "v0.0.19",
  "versionId": "616982011965384363",
  "modify_by": "266c6a42-6131-4d62-8f39-853e7093701c",
  "biz_domain_id": "bd_public"
}', 1777279536561687626 from DUAL where not exists (select f_id from kweaver.t_flow_dag_version where f_id = 616982011965384363);


INSERT INTO kweaver.t_flow_dag_var
(f_id, f_dag_id, f_var_name, f_default_value, f_var_type, f_description)
select 617284477068093151, 616502025026315947, 'docid', '', 'string', '' from DUAL
where not exists (select f_id from kweaver.t_flow_dag_var where f_id = 617284477068093151);

INSERT INTO kweaver.t_flow_dag_var
(f_id, f_dag_id, f_var_name, f_default_value, f_var_type, f_description)
select 617284477068158687, 616502025026315947, 'userid', '5f88d1e0-3ebb-11f1-8993-261248b384b3', 'string', '' from DUAL
where not exists (select f_id from kweaver.t_flow_dag_var where f_id = 617284477068158687);


INSERT INTO kweaver.t_flow_dag_step
(f_id, f_dag_id, f_operator, f_source_id, f_has_datasource)
select 616982011965580971, 616502025026315947, '@trigger/form', '', 0 from DUAL
where not exists (select f_id from kweaver.t_flow_dag_step where f_id = 616982011965580971);
INSERT INTO kweaver.t_flow_dag_step
(f_id, f_dag_id, f_operator, f_source_id, f_has_datasource)
select 616982011965646507, 616502025026315947, '@workflow/approval', '', 0 from DUAL
where not exists (select f_id from kweaver.t_flow_dag_step where f_id = 616982011965646507);
INSERT INTO kweaver.t_flow_dag_step
(f_id, f_dag_id, f_operator, f_source_id, f_has_datasource)
select 616982011965712043, 616502025026315947, '@internal/tool/py3', '', 0 from DUAL
where not exists (select f_id from kweaver.t_flow_dag_step where f_id = 616982011965712043);


INSERT INTO kweaver.t_flow_dag_accessor
(f_id, f_dag_id, f_accessor_id)
select 617257301468096223, 616502025026315947, '266c6a42-6131-4d62-8f39-853e7093701c' from DUAL
where not exists (select f_id from kweaver.t_flow_dag_accessor where f_id = 617257301468096223);



INSERT INTO kweaver.t_bd_resource_r
(created_at, updated_at, deleted_at, f_bd_id, f_resource_id, f_resource_type, f_create_by)
select '2026-04-24 09:17:22.061', '2026-04-24 09:17:22.061', NULL, 'bd_public', '616502025026315947:default', 'data_flow', '-' from DUAL
where not exists (select f_id from kweaver.t_bd_resource_r where f_resource_id = '616502025026315947:default' and f_resource_type = 'data_flow');