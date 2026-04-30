#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Metric comparison utility.

Supports two modes:
1) A/B condition comparison on one metric.
2) Grouped structure/proportion comparison.
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


def _parse_cond(item: str, arg_name: str) -> dict[str, Any]:
    parts = [x.strip() for x in item.split(",", 3)]
    if len(parts) != 4:
        raise ValueError(f"{arg_name} format invalid; expected field,op,value_type,value")
    field, op, value_type, raw_value = parts
    if value_type not in ("string", "number", "bool"):
        raise ValueError(f"{arg_name} value_type must be string|number|bool")
    value = _parse_value(raw_value, value_type)
    return {"field": field, "operation": op, "value_from": "const", "value": value}


def _extract_first_value(raw: str) -> float:
    data = json.loads(raw)
    series = data.get("datas") or []
    if not series:
        return 0.0
    values = series[0].get("values") or []
    if not values:
        return 0.0
    return float(values[0])


def _extract_group_rows(raw: str) -> list[dict[str, Any]]:
    data = json.loads(raw)
    rows: list[dict[str, Any]] = []
    for item in (data.get("datas") or []):
        labels = item.get("labels") or {}
        values = item.get("values") or []
        proportions = item.get("proportions") or []
        rows.append(
            {
                "labels": labels,
                "value": float(values[0]) if values else 0.0,
                "proportion": float(proportions[0]) if proportions else None,
            }
        )
    return rows


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="A/B compare or grouped proportion compare on one metric")
    p.add_argument("--kn-id", required=True, help="knowledge network id")
    p.add_argument("--metric-id", required=True, help="metric id")
    p.add_argument("--cond-a", default="", help="AB mode: field,op,value_type,value")
    p.add_argument("--cond-b", default="", help="AB mode: field,op,value_type,value")
    p.add_argument(
        "--group-fields",
        default="",
        help="group mode: comma-separated fields, e.g. regstate_cn,regorg_cn",
    )
    p.add_argument("--proportion", action="store_true", help="group mode: enable metrics.type=proportion")
    p.add_argument("--cond", action="append", default=[], help="group mode filter: field,op,value_type,value")
    p.add_argument("--logic", choices=["and", "or"], default="and")
    p.add_argument("--limit", type=int, default=200)
    p.add_argument("--base-url", default=default_execute_base_url())
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
    p.add_argument("--no-pretty", action="store_true")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1 or args.limit > 10000:
        print("--limit must be in [1,10000]", file=sys.stderr)
        return 2

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

    # Mode 1: A/B condition compare.
    if args.cond_a and args.cond_b:
        try:
            cond_a = _parse_cond(args.cond_a, "--cond-a")
            cond_b = _parse_cond(args.cond_b, "--cond-b")
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2
        body_a = {"condition": {"operation": args.logic, "sub_conditions": [cond_a]}, "limit": args.limit}
        body_b = {"condition": {"operation": args.logic, "sub_conditions": [cond_b]}, "limit": args.limit}

        code_a, raw_a, err_a = http_request(
            url, method="POST", headers=headers, body=body_a, timeout=args.timeout, insecure=args.insecure
        )
        if code_a != 0:
            print(err_a, file=sys.stderr)
            return 1

        code_b, raw_b, err_b = http_request(
            url, method="POST", headers=headers, body=body_b, timeout=args.timeout, insecure=args.insecure
        )
        if code_b != 0:
            print(err_b, file=sys.stderr)
            return 1

        a_val = _extract_first_value(raw_a)
        b_val = _extract_first_value(raw_b)
        out = {
            "mode": "ab_compare",
            "metric_id": args.metric_id,
            "condition_a": cond_a,
            "condition_b": cond_b,
            "value_a": a_val,
            "value_b": b_val,
            "delta_a_minus_b": a_val - b_val,
            "ratio_a_div_b": (a_val / b_val) if b_val != 0 else None,
        }
    else:
        # Mode 2: grouped structure/proportion compare.
        dims = [x.strip() for x in args.group_fields.split(",") if x.strip()]
        if not dims:
            print("Group mode requires --group-fields, or provide both --cond-a and --cond-b", file=sys.stderr)
            return 2
        try:
            sub_conditions = [_parse_cond(item, "--cond") for item in args.cond]
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 2

        body: dict[str, Any] = {"analysis_dimensions": dims, "limit": args.limit}
        if sub_conditions:
            body["condition"] = {"operation": args.logic, "sub_conditions": sub_conditions}
        if args.proportion:
            body["metrics"] = {"type": "proportion"}

        code, raw, err = http_request(
            url, method="POST", headers=headers, body=body, timeout=args.timeout, insecure=args.insecure
        )
        if code != 0:
            print(err, file=sys.stderr)
            return 1
        out = {
            "mode": "group_compare",
            "metric_id": args.metric_id,
            "group_fields": dims,
            "proportion_enabled": args.proportion,
            "rows": _extract_group_rows(raw),
        }

    if args.no_pretty:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

