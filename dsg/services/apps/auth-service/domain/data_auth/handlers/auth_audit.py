# 工作流的审核完成后执行的操作代码

from datetime import datetime, timedelta, timezone
import requests
from aishu_anyshare_api import ApiClient
import logging
import json
from urllib.parse import urljoin
from collections.abc import Mapping


def main(data_type, display_data, audit_data):
    host = ApiClient.get_global_host()
    token = ApiClient.get_global_access_token()

    # host 可能形如 "192.168.40.63:443" / "https://192.168.40.63:443/" / "://192.168.40.63:443/"
    if isinstance(host, str) and host.startswith("http"):
        base = host
    elif isinstance(host, str) and host.startswith("://"):
        base = "https{0}".format(host)
    else:
        base = "https://{0}".format(host)
    if not base.endswith("/"):
        base += "/"
    base_url = urljoin(base, "api/auth-service/v1/data-auth/operation")

    display_data = json.loads(display_data)
    audit_data = json.loads(audit_data)

    # 使用审核人员修改的过期时间
    audit_data["expiration"] = display_data["expiration"]
    if data_type == "data_view_row_column_type":
        audit_data["column_rules"]= display_data["column_rules"]
        audit_data["row_rules"]= display_data["row_rules"]

    # 2. 给用户授权（使用字典结构）
    arg = {
        "data_type": data_type,
        "audit_data": json.dumps(audit_data),
    }

    logging.info(arg)
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer {0}".format(token),
    }
    resp = requests.post(base_url, json=arg, headers=headers, timeout=30, verify=False)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        # 把后端返回的具体报错信息带出来（400 时非常关键）
        raise Exception("fail: {0}; body={1}".format(e, resp.text))
    payload = resp.json() if resp.content else {}
    # 兼容后端返回 {"code":"0","description":"成功","solution":""} 的成功结构
    code = payload.get("code") if isinstance(payload, Mapping) else None
    if str(code) != "0":
        raise Exception("fail: unexpected response body={0}".format(payload))
    return "success"