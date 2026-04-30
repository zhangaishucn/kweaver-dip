#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Metric query for mixed scenario: group-by + conditional filtering.

Example (PowerShell):
  python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py ^
    --kn-id d7o7gil4g3h4iis9fvg0 ^
    --metric-id d7o7mfl4g3h4iis9fvhg ^
    --group-fields regstate_cn,regorg_cn ^
    --logic and ^
    --cond regstate_cn,==,string,注销 ^
    --cond regcap,>,number,1000 ^
    --bearer "<TOKEN>" ^
    -bd bd_public ^
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

DEFAULT_BASE_URL = "https://192.168.40.63"


def default_execute_base_url() -> str:
    return (
        os.environ.get("ONTOLOGY_QUERY_BASE_URL")
        or os.environ.get("KWEAVER_BASE_URL")
        or DEFAULT_BASE_URL
    ).rstrip("/")


def build_metric_headers(
    *,
    account_id: str = "",
    account_type: str = "",
    kn_id: str = "",
    business_domain: str = "",
    bearer: str = "",
) -> dict[str, str]:
    h: dict[str, str] = {"Accept": "application/json"}
    aid = (account_id or os.environ.get("X_ACCOUNT_ID") or "").strip()
    if aid:
        h["x-account-id"] = aid
    at = (account_type or os.environ.get("X_ACCOUNT_TYPE") or "").strip()
    if at:
        h["x-account-type"] = at
    kn = (kn_id or os.environ.get("X_KN_ID") or "").strip()
    if kn:
        h["x-kn-id"] = kn
    bd = (business_domain or os.environ.get("KWEAVER_BUSINESS_DOMAIN") or "").strip()
    if bd:
        h["x-business-domain"] = bd
    tok = (bearer or os.environ.get("KWEAVER_TOKEN") or "").strip()
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


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


def _parse_value(raw: str, value_type: str) -> Any:
    if value_type == "number":
        s = raw.strip()
        return float(s) if "." in s else int(s)
    if value_type == "bool":
        s = raw.strip().lower()
        if s in ("true", "1", "yes", "y"):
            return True
        if s in ("false", "0", "no", "n"):
            return False
        raise ValueError("bool value must be true/false")
    return raw


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Metric query with group-by + condition filters")
    p.add_argument("--kn-id", required=True, help="knowledge network id")
    p.add_argument("--metric-id", required=True, help="metric id")
    p.add_argument(
        "--group-fields",
        required=True,
        help="comma-separated fields, e.g. regstate_cn,regorg_cn",
    )
    p.add_argument("--logic", choices=["and", "or"], default="and")
    p.add_argument(
        "--cond",
        action="append",
        default=[],
        help="repeatable: field,op,value_type,value (e.g. regcap,>,number,1000)",
    )
    p.add_argument("--limit", type=int, default=200)
    p.add_argument(
        "--base-url",
        default=default_execute_base_url(),
        help="ontology-query base url (default from env or built-in)",
    )
    p.add_argument(
        "--api-prefix",
        default=os.environ.get("ONTOLOGY_QUERY_API_PREFIX", "/api/ontology-query/v1"),
    )
    p.add_argument("--account-id", default=os.environ.get("X_ACCOUNT_ID", ""))
    p.add_argument(
        "--account-type",
        default=os.environ.get("X_ACCOUNT_TYPE", ""),
        choices=["", "user", "app", "anonymous"],
    )
    p.add_argument("--business-domain", "-bd", default=os.environ.get("KWEAVER_BUSINESS_DOMAIN", ""))
    p.add_argument("--bearer", default=os.environ.get("KWEAVER_TOKEN", ""))
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--insecure", action="store_true")
    p.add_argument("-o", "--output")
    p.add_argument("--no-pretty", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1 or args.limit > 10000:
        print("--limit must be in [1,10000]", file=sys.stderr)
        return 2

    dims = [x.strip() for x in args.group_fields.split(",") if x.strip()]
    if not dims:
        print("--group-fields cannot be empty", file=sys.stderr)
        return 2

    sub_conditions: list[dict[str, Any]] = []
    for i, item in enumerate(args.cond, start=1):
        parts = [x.strip() for x in item.split(",", 3)]
        if len(parts) != 4:
            print(f"--cond #{i} format invalid; expected field,op,value_type,value", file=sys.stderr)
            return 2
        field, op, value_type, raw_value = parts
        if value_type not in ("string", "number", "bool"):
            print(f"--cond #{i} value_type must be string|number|bool", file=sys.stderr)
            return 2
        try:
            value = _parse_value(raw_value, value_type)
        except ValueError as exc:
            print(f"--cond #{i}: {exc}", file=sys.stderr)
            return 2
        sub_conditions.append(
            {"field": field, "operation": op, "value_from": "const", "value": value}
        )

    body: dict[str, Any] = {"analysis_dimensions": dims, "limit": args.limit}
    if sub_conditions:
        body["condition"] = {"operation": args.logic, "sub_conditions": sub_conditions}

    base = args.base_url.rstrip("/")
    prefix = args.api_prefix.rstrip("/")
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    url = f"{base}{prefix}/knowledge-networks/{args.kn_id}/metrics/{args.metric_id}/data"

    headers = build_metric_headers(
        account_id=args.account_id,
        account_type=args.account_type,
        kn_id=args.kn_id,
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

