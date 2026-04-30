#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
申请数据视图权限（data_query）。

接口：
  POST /api/auth-service/v1/data-auth/apply

必填参数：
  --dataview-id
  --user-id
  --user-name
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request


DEFAULT_BASE_URL = "http://127.0.0.1:8155"
DEFAULT_PATH = "/api/auth-service/v1/data-auth/apply"
DEFAULT_EXPIRED_AT = 4084016461


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Apply data_query permission for a dataview")
    p.add_argument("--dataview-id", required=True, help="Target dataview id")
    p.add_argument("--user-id", required=True, help="Applicant user id")
    p.add_argument("--user-name", required=True, help="Applicant user name")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Service base url")
    p.add_argument("--token", default=os.environ.get("DATA_AUTH_TOKEN", ""), help="Bearer token")
    p.add_argument("--apply-type", default="", help="Apply type, default empty")
    p.add_argument("--expired-at", type=int, default=DEFAULT_EXPIRED_AT, help="Permission expiry timestamp (seconds)")
    p.add_argument("--insecure", action="store_true", help="Skip TLS certificate verification")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    token = args.token.strip()
    if not token:
        print("Missing --token (or env DATA_AUTH_TOKEN)", file=sys.stderr)
        return 2

    base_url = args.base_url.rstrip("/")
    url = f"{base_url}{DEFAULT_PATH}"
    payload = {
        "resource_id": [args.dataview_id],
        "apply_type": args.apply_type,
        "applicant_id": args.user_id,
        "applicant_name": args.user_name,
        "applicant_type": "user",
        "auth_operations": ["data_query"],
        "expired_at": args.expired_at,
    }

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    context: ssl.SSLContext | None = None
    if args.insecure:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url=url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=context, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(raw)
                print(json.dumps(data, ensure_ascii=False, indent=2))
            except json.JSONDecodeError:
                print(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} {e.reason}\n{detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
