#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
查询知识网络下的指标列表。

示例：
  python skills/smart-data-analysis/scripts/metric_list.py ^
    --kn-id d7o7gil4g3h4iis9fvg0 ^
    --bearer "<TOKEN>" ^
    --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 ^
    --account-type user ^
    --insecure
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlencode

DEFAULT_BASE_URL = "https://192.168.40.63"
DEFAULT_API_PREFIX = os.environ.get("BKN_BACKEND_API_PREFIX", "/api/bkn-backend/v1")


def default_execute_base_url() -> str:
    return (
        os.environ.get("BKN_BACKEND_BASE_URL")
        or os.environ.get("KWEAVER_BASE_URL")
        or DEFAULT_BASE_URL
    ).rstrip("/")


def append_query(url: str, params: dict[str, Any]) -> str:
    q: dict[str, Any] = {}
    for key, value in params.items():
        if value is None or value == "":
            continue
        if isinstance(value, bool):
            q[key] = str(value).lower()
        else:
            q[key] = value
    if not q:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{urlencode(q)}"


def build_headers(
    *,
    account_id: str = "",
    account_type: str = "",
    business_domain: str = "",
    bearer: str = "",
) -> dict[str, str]:
    headers: dict[str, str] = {"Accept": "application/json"}
    aid = (account_id or os.environ.get("X_ACCOUNT_ID") or "").strip()
    if aid:
        headers["x-account-id"] = aid
    at = (account_type or os.environ.get("X_ACCOUNT_TYPE") or "").strip()
    if at:
        headers["x-account-type"] = at
    bd = (business_domain or os.environ.get("KWEAVER_BUSINESS_DOMAIN") or "").strip()
    if bd:
        headers["x-business-domain"] = bd
    tok = (bearer or os.environ.get("KWEAVER_TOKEN") or "").strip()
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    return headers


def http_get(
    url: str,
    *,
    headers: dict[str, str],
    timeout: float = 120.0,
    insecure: bool = False,
) -> tuple[int, str, str]:
    req = urllib.request.Request(url, method="GET", headers=headers)
    ctx = ssl._create_unverified_context() if insecure else None
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return 0, raw, ""
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        return 1, "", f"HTTP {exc.code} {exc.reason}\n{err_body}"
    except urllib.error.URLError as exc:
        return 1, "", f"Request failed: {exc.reason}"


def select_fields(payload: Any, fields: list[str]) -> Any:
    if not fields:
        return payload
    if not isinstance(payload, list):
        return payload
    out: list[dict[str, Any]] = []
    for item in payload:
        if isinstance(item, dict):
            out.append({k: item.get(k) for k in fields})
        else:
            out.append({"value": item})
    return out


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="List metrics in a knowledge network")
    p.add_argument("--kn-id", required=True, help="knowledge network id")
    p.add_argument(
        "--base-url",
        default=default_execute_base_url(),
        help=f"bkn-backend origin (default: {DEFAULT_BASE_URL}; env: BKN_BACKEND_BASE_URL / KWEAVER_BASE_URL)",
    )
    p.add_argument(
        "--api-prefix",
        default=DEFAULT_API_PREFIX,
        help="Path prefix before /knowledge-networks/... (default BKN_BACKEND_API_PREFIX or /api/bkn-backend/v1)",
    )
    p.add_argument("--branch", default=os.environ.get("BKN_BRANCH", ""), help="branch name (optional)")
    p.add_argument("--keyword", default="", help="metric keyword filter (optional)")
    p.add_argument("--metric-type", default="", help="metric type filter (optional)")
    p.add_argument("--scope-type", default="", help="scope type filter (optional)")
    p.add_argument("--limit", type=int, default=100, help="page size (default: 100)")
    p.add_argument("--offset", type=int, default=0, help="page offset (default: 0)")
    p.add_argument("--strict-mode", action="store_true", help="set strict_mode=true in query")
    p.add_argument("--account-id", default=os.environ.get("X_ACCOUNT_ID", ""))
    p.add_argument(
        "--account-type",
        default=os.environ.get("X_ACCOUNT_TYPE", ""),
        choices=["", "user", "app", "anonymous"],
    )
    p.add_argument("--business-domain", "-bd", default=os.environ.get("KWEAVER_BUSINESS_DOMAIN", ""))
    p.add_argument("--bearer", default="", help="Authorization Bearer token (or KWEAVER_TOKEN)")
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--insecure", action="store_true", help="Skip TLS certificate verification")
    p.add_argument(
        "--fields",
        default="id,name,metric_type,scope_type,scope_ref,comment,update_time",
        help="comma-separated fields when payload is an array (default common metric fields)",
    )
    p.add_argument("-o", "--output", help="Write raw response to file (UTF-8)")
    p.add_argument("--no-pretty", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1 or args.limit > 1000:
        print("--limit must be in [1,1000]", file=sys.stderr)
        return 2
    if args.offset < 0:
        print("--offset must be >= 0", file=sys.stderr)
        return 2

    base = (args.base_url or "").rstrip("/")
    if not base:
        print("Missing --base-url (or BKN_BACKEND_BASE_URL / KWEAVER_BASE_URL)", file=sys.stderr)
        return 2
    kn = (args.kn_id or "").strip()
    if not kn:
        print("Missing --kn-id", file=sys.stderr)
        return 2

    prefix = (args.api_prefix or "").rstrip("/")
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    url = f"{base}{prefix}/knowledge-networks/{kn}/metrics"
    url = append_query(
        url,
        {
            "branch": args.branch,
            "keyword": args.keyword,
            "metric_type": args.metric_type,
            "scope_type": args.scope_type,
            "limit": args.limit,
            "offset": args.offset,
            "strict_mode": args.strict_mode,
        },
    )

    headers = build_headers(
        account_id=args.account_id,
        account_type=args.account_type,
        business_domain=args.business_domain,
        bearer=args.bearer,
    )
    code, raw, err = http_get(
        url,
        headers=headers,
        timeout=args.timeout,
        insecure=args.insecure,
    )
    if code != 0:
        print(err, file=sys.stderr)
        return 1

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(raw)
        print(f"Wrote {len(raw)} bytes to {args.output}", file=sys.stderr)
        return 0

    if args.no_pretty:
        print(raw)
        return 0

    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        print(raw)
        return 0

    fields = [x.strip() for x in args.fields.split(",") if x.strip()]
    compact = select_fields(obj, fields)
    print(json.dumps(compact, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
