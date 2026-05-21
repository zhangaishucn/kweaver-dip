# -*- coding: utf-8 -*-
"""
根据 Vega Backend Resource 详情生成数据理解（语义补全/业务对象）所需的 form_view 结构。

接口：GET /api/vega-backend/v1/resources/{ids}（ids 逗号分隔）
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.api.base import API, HTTPMethod
from app.logs.logger import logger
from config import get_settings

_RESOURCES_PATH = "/api/vega-backend/v1/resources"


def resolve_vega_backend_base_url() -> str:
    """解析 Vega Backend 根 URL（不含 path），来自环境/Settings。"""
    s = get_settings()
    for candidate in (
        s.VEGA_BACKEND_BASE_URL,
        s.OUTTER_VEGA_URL,
        s.AF_DEBUG_IP,
        s.AF_IP,
    ):
        url = (candidate or "").strip()
        if url:
            return url.rstrip("/")
    return "http://localhost:8080"


def _auth_header(token: str) -> str:
    t = (token or "").strip()
    if not t:
        return ""
    if t.lower().startswith("bearer "):
        return t
    return f"Bearer {t}"


def resource_to_form_view(resource: Dict[str, Any]) -> Dict[str, Any]:
    """将 Vega Resource 转为 form_view（兼容 data_understand_handler 下游逻辑）。"""
    rid = str(resource.get("id") or "")
    name = str(resource.get("name") or resource.get("source_identifier") or "")
    form_view: Dict[str, Any] = {
        "form_view_id": rid,
        "view_id": rid,
        "form_view_technical_name": name,
        "form_view_business_name": name,
        "form_view_desc": str(resource.get("description") or ""),
        "form_view_fields": [],
    }

    schema = resource.get("schema_definition")
    if isinstance(schema, list) and schema:
        for prop in schema:
            if not isinstance(prop, dict):
                continue
            field_name = str(prop.get("name") or "")
            form_view["form_view_fields"].append({
                "form_view_field_id": field_name,
                "form_view_field_technical_name": str(
                    prop.get("original_name") or prop.get("name") or ""
                ),
                "form_view_field_business_name": str(
                    prop.get("display_name") or prop.get("name") or ""
                ),
                "form_view_field_type": str(prop.get("type") or ""),
                "form_view_field_desc": str(prop.get("description") or ""),
            })
        return form_view

    source_meta = resource.get("source_metadata")
    if isinstance(source_meta, dict):
        for col in source_meta.get("columns") or []:
            if not isinstance(col, dict):
                continue
            field_name = str(col.get("name") or "")
            form_view["form_view_fields"].append({
                "form_view_field_id": field_name,
                "form_view_field_technical_name": field_name,
                "form_view_field_business_name": field_name,
                "form_view_field_type": str(col.get("type") or ""),
                "form_view_field_desc": str(col.get("description") or ""),
            })

    return form_view


async def fetch_resources_by_ids(
    resource_ids: List[str],
    token: str,
    base_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    批量获取 Resource 详情（单次 GET，path 逗号分隔 ids）。

    Returns:
        与 resource_ids 顺序一致的 Resource dict 列表。

    Raises:
        Exception: 鉴权缺失、HTTP 非 200、或返回 entries 与请求 id 不匹配。
    """
    if not resource_ids:
        return []

    auth = _auth_header(token)
    if not auth:
        raise ValueError("Authorization token is required")

    root = (base_url or resolve_vega_backend_base_url()).rstrip("/")
    ids_path = ",".join(resource_ids)
    url = f"{root}{_RESOURCES_PATH}/{ids_path}"
    headers = {"Authorization": auth, "Accept": "application/json"}

    api = API(url=url, headers=headers, method=HTTPMethod.GET)
    body = await api.call_async(verify=False)

    if not isinstance(body, dict):
        raise ValueError(f"resource 详情响应格式异常: {type(body)}")

    entries = body.get("entries")
    if not isinstance(entries, list):
        raise ValueError("resource 详情响应缺少 entries")

    by_id: Dict[str, Dict[str, Any]] = {}
    for item in entries:
        if isinstance(item, dict) and item.get("id"):
            by_id[str(item["id"])] = item

    ordered: List[Dict[str, Any]] = []
    missing: List[str] = []
    for rid in resource_ids:
        if rid in by_id:
            ordered.append(by_id[rid])
        else:
            missing.append(rid)

    if missing:
        raise ValueError(f"resource 不存在或未返回: {missing}")

    return ordered


async def generate_form_view_from_resource_id(
    resource_id: str,
    token: str,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """按单个 resource id 拉取详情并转为 form_view。"""
    resources = await fetch_resources_by_ids([resource_id], token, base_url)
    return resource_to_form_view(resources[0])


async def generate_form_views_from_resource_ids(
    resource_ids: List[str],
    token: str,
    base_url: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """批量 resource id → form_view 列表（一次 HTTP 批量 GET）。"""
    resources = await fetch_resources_by_ids(resource_ids, token, base_url)
    return [resource_to_form_view(r) for r in resources]
