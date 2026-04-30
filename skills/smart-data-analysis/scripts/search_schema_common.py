# -*- coding: utf-8 -*-
"""
Shared client for POST /api/agent-retrieval/in/v1/kn/search_schema (OpenAPI search_schema).

Canonical copy lives under this skill: ``smart-data-analysis/scripts/``.
Repo ``tests/search_schema_*.py`` wrappers prepend this directory to ``sys.path`` and import from here.
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

# 与平台 BKN/指标等脚本默认同主机。若本路径返回 404，而 :30779 可通，可设
#   SEARCH_SCHEMA_BASE_URL=http://192.168.40.63:30779
DEFAULT_BASE_URL = "https://192.168.40.63"
API_PATH = "/api/agent-retrieval/in/v1/kn/search_schema"

OBJECT_TYPES_SCOPE: dict[str, bool] = {
    "include_object_types": True,
    "include_relation_types": False,
    "include_action_types": False,
    "include_metric_types": False,
}
RELATION_TYPES_SCOPE: dict[str, bool] = {
    "include_object_types": False,
    "include_relation_types": True,
    "include_action_types": False,
    "include_metric_types": False,
}
ACTION_TYPES_SCOPE: dict[str, bool] = {
    "include_object_types": False,
    "include_relation_types": False,
    "include_action_types": True,
    "include_metric_types": False,
}
METRIC_TYPES_SCOPE: dict[str, bool] = {
    "include_object_types": False,
    "include_relation_types": False,
    "include_action_types": False,
    "include_metric_types": True,
}


def default_base_url() -> str:
    return (os.environ.get("SEARCH_SCHEMA_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def add_common_arguments(
    p: argparse.ArgumentParser,
    *,
    include_scope_negation_flags: bool,
) -> None:
    p.add_argument(
        "--base-url",
        default=default_base_url(),
        help=f"API origin (default: {DEFAULT_BASE_URL} or SEARCH_SCHEMA_BASE_URL)",
    )
    p.add_argument("-q", "--query", required=True, help="Natural language query (required)")
    p.add_argument("--kn-id", default=os.environ.get("KN_ID", ""), help="Knowledge network id (body kn_id)")
    p.add_argument(
        "--kn-id-header",
        default="",
        help="Force x-kn-id header only (if empty, uses --kn-id when set)",
    )
    p.add_argument("--account-id", default=os.environ.get("X_ACCOUNT_ID", ""))
    p.add_argument(
        "--account-type",
        default=os.environ.get("X_ACCOUNT_TYPE", ""),
        choices=["", "user", "app", "anonymous"],
        help="x-account-type (default: omit unless set)",
    )
    p.add_argument(
        "--response-format",
        choices=["json", "toon"],
        default="json",
        help="Query parameter response_format",
    )
    p.add_argument("--max-concepts", type=int, default=None, help="max_concepts (default: server default)")
    p.add_argument("--schema-brief", action="store_true", help="schema_brief=true")
    p.add_argument("--no-rerank", action="store_true", help="enable_rerank=false")
    if include_scope_negation_flags:
        p.add_argument("--no-object-types", action="store_true", help="include_object_types=false")
        p.add_argument("--no-relation-types", action="store_true", help="include_relation_types=false")
        p.add_argument("--no-action-types", action="store_true", help="include_action_types=false")
        p.add_argument("--no-metric-types", action="store_true", help="include_metric_types=false")
    p.add_argument("--timeout", type=float, default=120.0, help="Request timeout seconds")
    p.add_argument(
        "--insecure",
        action="store_true",
        help="Skip TLS certificate verification (e.g. self-signed dev certs)",
    )
    p.add_argument("-o", "--output", help="Write response JSON to file (UTF-8); default: stdout")


def build_body(
    args: argparse.Namespace,
    fixed_scope: dict[str, bool] | None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"query": args.query}
    if args.kn_id:
        body["kn_id"] = args.kn_id
    if args.max_concepts is not None:
        body["max_concepts"] = args.max_concepts
    if args.schema_brief:
        body["schema_brief"] = True
    if args.no_rerank:
        body["enable_rerank"] = False

    if fixed_scope is not None:
        body["search_scope"] = dict(fixed_scope)
    else:
        scope: dict[str, bool] = {}
        if getattr(args, "no_object_types", False):
            scope["include_object_types"] = False
        if getattr(args, "no_relation_types", False):
            scope["include_relation_types"] = False
        if getattr(args, "no_action_types", False):
            scope["include_action_types"] = False
        if getattr(args, "no_metric_types", False):
            scope["include_metric_types"] = False
        if scope:
            body["search_scope"] = scope
    return body


def build_headers(args: argparse.Namespace) -> dict[str, str]:
    h: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
    if args.account_id or os.environ.get("X_ACCOUNT_ID"):
        h["x-account-id"] = (args.account_id or os.environ.get("X_ACCOUNT_ID") or "").strip()
    if args.account_type or os.environ.get("X_ACCOUNT_TYPE"):
        h["x-account-type"] = (args.account_type or os.environ.get("X_ACCOUNT_TYPE") or "user").strip()
    kn = (args.kn_id_header or args.kn_id or os.environ.get("X_KN_ID") or "").strip()
    if kn:
        h["x-kn-id"] = kn
    return h


def run_request(args: argparse.Namespace, fixed_scope: dict[str, bool] | None) -> int:
    url = f"{args.base_url.rstrip('/')}{API_PATH}?response_format={args.response_format}"
    body = build_body(args, fixed_scope)
    headers = build_headers(args)
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers=headers)
    ctx = ssl._create_unverified_context() if getattr(args, "insecure", False) else None

    try:
        with urllib.request.urlopen(req, timeout=args.timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            ct = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} {e.reason}\n{err_body}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        return 1

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(raw)
        print(f"Wrote {len(raw)} bytes to {args.output} (Content-Type: {ct})", file=sys.stderr)
    else:
        try:
            obj = json.loads(raw)
            print(json.dumps(obj, ensure_ascii=False, indent=2))
        except json.JSONDecodeError:
            print(raw)
    return 0


def main_general() -> int:
    p = argparse.ArgumentParser(
        description="search_schema API — full / selective scope via --no-* flags",
    )
    add_common_arguments(p, include_scope_negation_flags=True)
    return run_request(p.parse_args(), fixed_scope=None)


def main_fixed_scope(
    scope: dict[str, bool],
    *,
    prog: str,
    description: str,
) -> int:
    p = argparse.ArgumentParser(prog=prog, description=description)
    add_common_arguments(p, include_scope_negation_flags=False)
    return run_request(p.parse_args(), fixed_scope=scope)
