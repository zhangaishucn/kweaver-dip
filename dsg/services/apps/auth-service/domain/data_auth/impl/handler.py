# 工作流的审核完成后执行的操作代码

from datetime import datetime, timedelta, timezone
import requests
from aishu_anyshare_api import ApiClient
import logging
from urllib.parse import urljoin
from collections.abc import Mapping


def main(data_view_id,applicant_id, applicant_type, operations, expiration,data_view_name):
    host = ApiClient.get_global_host()
    token = ApiClient.get_global_access_token()

    # host 可能形如 "192.168.40.63:443" / "https://192.168.40.63:443/" / "://192.168.40.63:443/"
    if isinstance(host, str) and host.startswith("http"):
        base = host
    elif isinstance(host, str) and host.startswith("://"):
        base = f"https{host}"
    else:
        base = f"https://{host}"
    if not base.endswith("/"):
        base += "/"
    base_url = urljoin(base, "api/authorization/v1/policy")


    # operations 可能是 "a,b,c" 或 list；同时可能包含空格/空项
    if isinstance(operations, str):
        operation_list = [op.strip() for op in operations.split(",") if op.strip()]
    else:
        operation_list = [str(op).strip() for op in (operations or []) if str(op).strip()]

    if expiration == "永不过期":
        expires_at = "1970-01-01T08:00:00+08:00"
    else:
        # input_params["expiration"] 是北京时间字符串（如 2099-12-31 23:59:59），转换为 RFC3339
        expires_at = datetime.strptime(expiration, "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone(timedelta(hours=8))
        ).isoformat()


    # 2. 给用户授权（使用字典结构）
    arg =[ {
        "accessor": {
            "id": applicant_id,
            "type": applicant_type,
        },
        "resource": {
            "id": data_view_id,
            "name": data_view_name,
            "type": "data_view",
        },
        "operation": {
            "allow": [{"id": op} for op in operation_list],
            "deny": [],
        },
        "expires_at": expires_at,
    }]

    logging.info(arg)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        # 把后端返回的具体报错信息带出来（400 时非常关键）
        return f"fail: {e}; body={resp.text}"

    payload = resp.json() if resp.content else {}
    ids = payload.get("ids") if isinstance(payload, Mapping) else None
    if not ids:
        return f"fail: unexpected response body={payload}"
    return "success"