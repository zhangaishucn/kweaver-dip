#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
执行指标查询（带条件筛选），将筛选条件作为命令行参数传入。

默认用于当前已验证的“企业状态对象类型总数”指标：
  - kn_id: d7lj3i54g3h4iis9fubg
  - metric_id: d7nidst4g3h4iis9fur0

单条件示例：
  python skills/smart-data-analysis/scripts/metric_query_with_condition.py ^
    --field regstate_cn ^
    --op "==" ^
    --value 注销 ^
    --bearer "<TOKEN>" ^
    --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 ^
    --account-type user ^
    --insecure

多条件示例（AND）：
  python skills/smart-data-analysis/scripts/metric_query_with_condition.py ^
    --logic and ^
    --cond regstate_cn,==,string,注销 ^
    --cond regcap,>,number,1000 ^
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


def default_execute_base_url() -> str:
    return (
        os.environ.get("ONTOLOGY_QUERY_BASE_URL")
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


def build_metric_headers(
    *,
    account_id: str = "",
    account_type: str = "",
    kn_id: str = "",
    kn_id_header: str = "",
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
    kn = (kn_id_header or kn_id or os.environ.get("X_KN_ID") or "").strip()
    if kn:
        headers["x-kn-id"] = kn
    bd = (business_domain or os.environ.get("KWEAVER_BUSINESS_DOMAIN") or "").strip()
    if bd:
        headers["x-business-domain"] = bd
    tok = (bearer or os.environ.get("KWEAVER_TOKEN") or "").strip()
    if tok:
        headers["Authorization"] = f"Bearer {tok}"
    return headers


def http_request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str],
    body: dict[str, Any] | None = None,
    timeout: float = 120.0,
    insecure: bool = False,
) -> tuple[int, str, str]:
    data: bytes | None = None
    req_headers = dict(headers)
    if body is not None:
        req_headers.setdefault("Content-Type", "application/json")
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method.upper(), headers=req_headers)
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


def print_response(raw: str, *, output_path: str | None, pretty: bool = True) -> None:
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(raw)
        print(f"Wrote {len(raw)} bytes to {output_path}", file=sys.stderr)
        return
    if pretty:
        try:
            obj = json.loads(raw)
            print(json.dumps(obj, ensure_ascii=False, indent=2))
            return
        except json.JSONDecodeError:
            pass
    print(raw)

DEFAULT_KN_ID = os.environ.get("KN_ID", "d7lj3i54g3h4iis9fubg")
DEFAULT_METRIC_ID = os.environ.get("METRIC_ID", "d7nidst4g3h4iis9fur0")
DEFAULT_API_PREFIX = os.environ.get("ONTOLOGY_QUERY_API_PREFIX", "/api/ontology-query/v1")


def _parse_value(raw: str, value_type: str) -> Any:
    if value_type == "number":
        s = raw.strip()
        if "." in s:
            return float(s)
        return int(s)
    if value_type == "bool":
        s = raw.strip().lower()
        if s in ("true", "1", "yes", "y"):
            return True
        if s in ("false", "0", "no", "n"):
            return False
        raise ValueError("--value for bool must be true/false")
    return raw


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Query metric data with one or more conditions from CLI args")
    p.add_argument(
        "--base-url",
        default=default_execute_base_url(),
        help=f"ontology-query origin (default: {DEFAULT_BASE_URL}; env: ONTOLOGY_QUERY_BASE_URL / KWEAVER_BASE_URL)",
    )
    p.add_argument(
        "--api-prefix",
        default=DEFAULT_API_PREFIX,
        help="Path prefix before /metrics/... (default ONTOLOGY_QUERY_API_PREFIX or /api/ontology-query/v1)",
    )
    p.add_argument("--kn-id", default=DEFAULT_KN_ID, help="knowledge network id")
    p.add_argument("--metric-id", default=DEFAULT_METRIC_ID, help="metric id")
    p.add_argument("--branch", default=os.environ.get("BKN_BRANCH", ""), help="query branch (optional)")
    p.add_argument(
        "--field",
        default="",
        help="condition field name, e.g. regstate_cn",
    )
    p.add_argument(
        "--op",
        default="==",
        help='condition operator, e.g. ==, !=, >, <, in, like, regex (default: ==)',
    )
    p.add_argument(
        "--value",
        default="",
        help="condition value",
    )
    p.add_argument(
        "--value-type",
        choices=["string", "number", "bool"],
        default="string",
        help="type parser for --value (default: string)",
    )
    p.add_argument(
        "--cond",
        action="append",
        default=[],
        help=(
            "repeatable multi-condition item: field,op,value_type,value "
            "(e.g. regstate_cn,==,string,注销)"
        ),
    )
    p.add_argument(
        "--logic",
        choices=["and", "or"],
        default="and",
        help="logical operator for multiple conditions (default: and)",
    )
    p.add_argument("--limit", type=int, default=1000, help="query limit (default: 1000)")
    p.add_argument("--account-id", default=os.environ.get("X_ACCOUNT_ID", ""))
    p.add_argument(
        "--account-type",
        default=os.environ.get("X_ACCOUNT_TYPE", ""),
        choices=["", "user", "app", "anonymous"],
    )
    p.add_argument("--kn-id-header", default="", help="x-kn-id header (defaults to --kn-id)")
    p.add_argument("--business-domain", "-bd", default=os.environ.get("KWEAVER_BUSINESS_DOMAIN", ""))
    p.add_argument("--bearer", default="", help="Authorization Bearer token (or KWEAVER_TOKEN)")
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--insecure", action="store_true", help="Skip TLS certificate verification")
    p.add_argument("-o", "--output", help="Write raw response to file (UTF-8)")
    p.add_argument("--no-pretty", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    base = (args.base_url or "").rstrip("/")
    if not base:
        print("Missing --base-url (or ONTOLOGY_QUERY_BASE_URL / KWEAVER_BASE_URL)", file=sys.stderr)
        return 2
    kn = (args.kn_id or "").strip()
    mid = (args.metric_id or "").strip()
    if not kn or not mid:
        print("Missing --kn-id or --metric-id", file=sys.stderr)
        return 2
    if args.limit < 1 or args.limit > 10000:
        print("--limit must be in [1,10000]", file=sys.stderr)
        return 2

    prefix = (args.api_prefix or "").rstrip("/")
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    url = f"{base}{prefix}/knowledge-networks/{kn}/metrics/{mid}/data"
    if args.branch:
        url = append_query(url, {"branch": args.branch})

    sub_conditions: list[dict[str, Any]] = []
    if args.cond:
        for i, item in enumerate(args.cond, start=1):
            parts = [x.strip() for x in item.split(",", 3)]
            if len(parts) != 4:
                print(
                    f"--cond #{i} format invalid, expected: field,op,value_type,value",
                    file=sys.stderr,
                )
                return 2
            field, op, value_type, value_raw = parts
            if value_type not in ("string", "number", "bool"):
                print(
                    f"--cond #{i} value_type must be one of: string, number, bool",
                    file=sys.stderr,
                )
                return 2
            try:
                value = _parse_value(value_raw, value_type)
            except ValueError as e:
                print(f"--cond #{i}: {e}", file=sys.stderr)
                return 2
            sub_conditions.append(
                {
                    "field": field,
                    "operation": op,
                    "value_from": "const",
                    "value": value,
                }
            )
    else:
        if not args.field.strip() or args.value == "":
            print(
                "Single-condition mode requires --field and --value (or use repeatable --cond)",
                file=sys.stderr,
            )
            return 2
        try:
            value = _parse_value(args.value, args.value_type)
        except ValueError as e:
            print(str(e), file=sys.stderr)
            return 2
        sub_conditions.append(
            {
                "field": args.field,
                "operation": args.op,
                "value_from": "const",
                "value": value,
            }
        )

    body = {
        "condition": {
            "operation": args.logic,
            "sub_conditions": sub_conditions,
        },
        "limit": args.limit,
    }

    headers = build_metric_headers(
        account_id=args.account_id,
        account_type=args.account_type,
        kn_id=kn,
        kn_id_header=args.kn_id_header,
        business_domain=args.business_domain,
        bearer=args.bearer,
    )

    code, raw, err = http_request(
        url,
        method="POST",
        headers=headers,
        body=body,
        timeout=args.timeout,
        insecure=args.insecure,
    )
    if code != 0:
        print(err, file=sys.stderr)
        return 1
    print_response(raw, output_path=args.output, pretty=not args.no_pretty)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
