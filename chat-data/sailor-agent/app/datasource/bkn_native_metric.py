# -*- coding: utf-8 -*-
"""
BKN 原生指标数据源：指标详情走 **bkn-backend**，指标查数走 **ontology-query**。

OpenAPI 参考（adp/docs）：
- `api/bkn/bkn-backend-api/bkn-metrics.yaml`
- `api/bkn/ontology-query-ai/ontology-query.yaml`

与 legacy `DIPMetric`（mdl-data-model + mdl-uniquery）并存；`text2metric` 可选用本类，
沿用 DIP 风格的 `query_params`（由 `DIPMetric.params_correction` 规范化）并转换为 ontology-query 请求体。
"""
from __future__ import annotations

import re
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from app.api.base import API, HTTPMethod
from app.api.error import AfDataSourceError
from app.datasource.api_base import APIDataSource
from app.datasource.dip_metric import DIPMetric
from app.logs.logger import logger
from app.utils.common import run_blocking
from config import get_settings

_SETTINGS = get_settings()

_RAW_KEY = "raw_"


class _DipParamsCorrectionBridge:
    """供复用 DIPMetric.params_correction；DIPMetric 为 Pydantic 模型，不能对 __new__ 实例动态挂方法。"""

    def __init__(self, bkn: "BKNNativeMetricDataSource"):
        self._bkn = bkn

    def get_metric_query_type(self, metric_id: str) -> str:
        return "sql"

    def get_description_by_ids(self, metric_ids):
        return self._bkn.get_description_by_ids(metric_ids)
_DESC_KEY = "description_"


def _unwrap_metric_detail_payload(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    entries = payload.get("entries")
    if isinstance(entries, list) and entries and isinstance(entries[0], dict):
        return entries[0]
    return payload


def _parse_look_back_delta_ms(look_back: str) -> int:
    """将 DIP 风格 look_back_delta（如 1h、7d、30d）转为毫秒，解析失败则 5 分钟。"""
    if not look_back or not isinstance(look_back, str):
        return 300_000
    s = look_back.strip().lower()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*([a-z]+)?$", s)
    if not m:
        return 300_000
    num = float(m.group(1))
    unit = (m.group(2) or "").strip()
    mult: Dict[str, float] = {
        "ms": 1.0,
        "s": 1000.0,
        "m": 60_000.0,
        "min": 60_000.0,
        "minute": 60_000.0,
        "h": 3_600_000.0,
        "hour": 3_600_000.0,
        "d": 86_400_000.0,
        "day": 86_400_000.0,
        "w": 604_800_000.0,
        "week": 604_800_000.0,
        "y": 31_536_000_000.0,
        "year": 31_536_000_000.0,
    }
    if not unit:
        return int(num * 1000)
    factor = mult.get(unit)
    if factor is not None:
        return int(num * factor)
    return int(num * 1000)


def _map_filter_field(name: str) -> str:
    if not name:
        return name
    if name.startswith("labels."):
        return name[7:]
    return name


def _dip_filter_to_condition(f: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(f, dict):
        return None
    field = _map_filter_field(str(f.get("name", "")))
    op = str(f.get("operation", "=")).strip().lower()
    val = f.get("value")
    if not field:
        return None
    if op in ("=", "=="):
        return {"field": field, "operation": "==", "value": val}
    if op in ("!=", "<>"):
        return {"field": field, "operation": "!=", "value": val}
    if op == "<":
        return {"field": field, "operation": "<", "value": val}
    if op == "<=":
        return {"field": field, "operation": "<=", "value": val}
    if op == ">":
        return {"field": field, "operation": ">", "value": val}
    if op == ">=":
        return {"field": field, "operation": ">=", "value": val}
    if op == "in":
        if not isinstance(val, list):
            val = [val]
        return {"field": field, "operation": "in", "value": val}
    if op in ("not in", "not_in"):
        if not isinstance(val, list):
            val = [val]
        return {"field": field, "operation": "not_in", "value": val}
    if op == "range":
        if isinstance(val, list) and len(val) >= 2:
            return {"field": field, "operation": "range", "value": val[:2]}
        return None
    if op in ("out_range", "out range"):
        if isinstance(val, list) and len(val) >= 2:
            return {"field": field, "operation": "out_range", "value": val[:2]}
        return None
    return None


def _condition_from_dip_filters(filters: Any) -> Optional[Dict[str, Any]]:
    if not filters or not isinstance(filters, list):
        return None
    subs: List[Dict[str, Any]] = []
    for item in filters:
        c = _dip_filter_to_condition(item)
        if c:
            subs.append(c)
    if not subs:
        return None
    if len(subs) == 1:
        return subs[0]
    return {"operation": "and", "sub_conditions": subs}


def _time_block_for_ontology(corrected: Dict[str, Any]) -> Dict[str, Any]:
    instant = bool(corrected.get("instant", False))
    out: Dict[str, Any] = {"instant": instant}
    if not instant:
        if corrected.get("start") is not None:
            out["start"] = corrected["start"]
        if corrected.get("end") is not None:
            out["end"] = corrected["end"]
        if corrected.get("step"):
            out["step"] = corrected["step"]
        return out
    if corrected.get("start") is not None and corrected.get("end") is not None:
        out["start"] = corrected["start"]
        out["end"] = corrected["end"]
        return out
    if corrected.get("time") is not None:
        end = int(corrected["time"])
        lb = corrected.get("look_back_delta") or "5m"
        delta = _parse_look_back_delta_ms(str(lb))
        out["start"] = end - delta
        out["end"] = end
        return out
    if corrected.get("start") is not None:
        out["start"] = corrected["start"]
    if corrected.get("end") is not None:
        out["end"] = corrected["end"]
    return out


class BKNNativeMetricDataSource(APIDataSource):
    """
    kn_id: 业务知识网络 ID（路径参数，必填）
    bkn_backend_base: bkn-backend 根 URL，默认 `ADP_ONTOLOGY_MANAGER_HOST`
    ontology_query_base: ontology-query 根 URL，默认 `ADP_ONTOLOGY_QUERY_HOST`
    """

    kn_id: str = ""
    branch: str = "main"
    bkn_backend_base: str = ""
    ontology_query_base: str = ""
    token: str = ""
    user_id: str = ""
    account_type: str = "user"
    metric_list: List[str] = []
    headers: Dict[str, Any] = {}
    cache_data: Dict[str, Any] = {}

    class Config:
        arbitrary_types_allowed = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.token and not str(self.token).startswith("Bearer "):
            self.token = f"Bearer {self.token}"
        if not self.bkn_backend_base:
            self.bkn_backend_base = _SETTINGS.ADP_ONTOLOGY_MANAGER_HOST
        if not self.ontology_query_base:
            self.ontology_query_base = _SETTINGS.ADP_ONTOLOGY_QUERY_HOST
        if not self.headers:
            self.headers = {
                "Authorization": self.token,
                "x-user": self.user_id,
                "x-account-id": self.user_id,
                "x-account-type": self.account_type,
            }
        else:
            if self.token:
                self.headers["Authorization"] = self.token
            if self.user_id:
                self.headers["x-user"] = self.user_id
                self.headers["x-account-id"] = self.user_id
                self.headers["x-account-type"] = self.account_type
        cache = self.__dict__.get("cache_data")
        if not isinstance(cache, dict):
            object.__setattr__(self, "cache_data", {})

    def _metric_detail_url(self, metric_id: str) -> str:
        base = self.bkn_backend_base.rstrip("/")
        return (
            f"{base}/api/bkn-backend/v1/knowledge-networks/{self.kn_id}/metrics/{metric_id}"
        )

    def _metric_data_url(self, metric_id: str) -> str:
        base = self.ontology_query_base.rstrip("/")
        return (
            f"{base}/api/ontology-query/v1/knowledge-networks/{self.kn_id}/metrics/{metric_id}/data"
        )

    def _merge_headers(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        h = dict(self.headers)
        if extra:
            h.update(extra)
        return h

    def get_metric_detail(self, metric_id: str) -> Dict[str, Any]:
        """同步：拉取单个指标定义（MetricDefinition）。"""
        return run_blocking(self.aget_metric_detail(metric_id))

    async def aget_metric_detail(self, metric_id: str) -> Dict[str, Any]:
        """异步：拉取单个指标定义。"""
        params: Dict[str, Any] = {}
        if self.branch:
            params["branch"] = self.branch
        api = API(
            url=self._metric_detail_url(metric_id),
            headers=self._merge_headers(),
            method=HTTPMethod.GET,
            params=params,
        )
        return await api.call_async()

    def _normalize_for_prompt(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        td = raw.get("time_dimension") if isinstance(raw.get("time_dimension"), dict) else {}
        prop = (td.get("property") or "").strip()
        adims = raw.get("analysis_dimensions") or []
        analysis_dimensions: List[Dict[str, Any]] = []
        for d in adims:
            if isinstance(d, dict):
                analysis_dimensions.append(
                    {
                        "name": d.get("name", ""),
                        "display_name": d.get("display_name") or d.get("name", ""),
                    }
                )
            else:
                analysis_dimensions.append({"name": str(d), "display_name": str(d)})
        return {
            "id": raw.get("id"),
            "name": raw.get("name"),
            "comment": raw.get("comment") or raw.get("name") or "",
            "metric_type": raw.get("metric_type"),
            "query_type": "sql",
            "unit": raw.get("unit") or "",
            "unit_type": raw.get("unit_type") or "",
            "analysis_dimensions": analysis_dimensions,
            "date_field": prop,
            "measure_field": None,
            "data_source": {},
            "formula_config": raw.get("calculation_formula"),
        }

    def get_metric_query_type(self, metric_id: str) -> str:
        return "sql"

    def get_description_by_ids(self, metric_ids: str | List[str]) -> List[Dict[str, Any]]:
        return run_blocking(self.aget_description_by_ids(metric_ids))

    async def aget_description_by_ids(self, metric_ids: str | List[str]) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        not_cached: List[str] = []
        ids = metric_ids if isinstance(metric_ids, list) else str(metric_ids).split(",")
        ids = [i.strip() for i in ids if i and str(i).strip()]

        for mid in ids:
            ck = f"{_DESC_KEY}{mid}"
            if ck in self.cache_data:
                result.append(deepcopy(self.cache_data[ck]))
            else:
                not_cached.append(mid)

        for mid in not_cached:
            raw_resp = await self.aget_metric_detail(mid)
            raw = _unwrap_metric_detail_payload(raw_resp)
            self.cache_data[f"{_RAW_KEY}{mid}"] = deepcopy(raw)
            norm = self._normalize_for_prompt(raw)
            self.cache_data[f"{_DESC_KEY}{mid}"] = deepcopy(norm)
            result.append(norm)

        return result

    def params_correction(self, params: Dict[str, Any], metric_id: str = None) -> dict:
        """复用 DIPMetric 的 SQL 路径参数修正（时间戳、step、filters 等）。"""
        return DIPMetric.params_correction(_DipParamsCorrectionBridge(self), params, metric_id)

    def build_ontology_metric_query_body(
        self, metric_id: str, corrected: Dict[str, Any]
    ) -> Dict[str, Any]:
        raw = self.cache_data.get(f"{_RAW_KEY}{metric_id}") or {}
        if not raw:
            details = self.get_description_by_ids(metric_id)
            raw = self.cache_data.get(f"{_RAW_KEY}{metric_id}") or {}
        td = raw.get("time_dimension") if isinstance(raw.get("time_dimension"), dict) else {}
        prop = (td.get("property") or "").strip()

        body: Dict[str, Any] = {}
        # 有 time 轴字段时与 ontology 契约一致，带 time + time_dimension；否则与瘦查询一致（不传二者），见 smart-data-analysis metric_group_filter_aggregate.py
        if prop:
            body["time"] = _time_block_for_ontology(corrected)
            body["time_dimension"] = {"property": prop}
            drp = td.get("default_range_policy")
            if drp is not None:
                body["time_dimension"]["default_range_policy"] = drp
        else:
            logger.info(
                "指标 %s 未配置 time_dimension.property，请求体省略 time / time_dimension",
                metric_id,
            )

        ad = corrected.get("analysis_dimensions")
        if isinstance(ad, list) and ad:
            body["analysis_dimensions"] = [str(x) for x in ad]

        cond = _condition_from_dip_filters(corrected.get("filters"))
        if cond:
            body["condition"] = cond

        if corrected.get("metrics"):
            body["metrics"] = corrected["metrics"]

        if corrected.get("order_by"):
            body["order_by"] = corrected["order_by"]
        if corrected.get("having"):
            body["having"] = corrected["having"]
        if corrected.get("limit") is not None:
            body["limit"] = corrected["limit"]

        return body

    def query_metric_data(
        self,
        metric_id: str,
        body: Dict[str, Any],
        *,
        fill_null: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """同步：按 ontology-query 契约查询指标数据（原生请求体）。"""
        return run_blocking(self.aquery_metric_data(metric_id, body, fill_null=fill_null))

    async def aquery_metric_data(
        self,
        metric_id: str,
        body: Dict[str, Any],
        *,
        fill_null: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """异步：查询指标数据（原生 ontology 请求体）。"""
        params: Dict[str, Any] = {}
        if self.branch:
            params["branch"] = self.branch
        if fill_null is not None:
            params["fill_null"] = "true" if fill_null else "false"

        api = API(
            url=self._metric_data_url(metric_id),
            headers=self._merge_headers(),
            method=HTTPMethod.POST,
            params=params,
            payload=body or {},
        )
        return await api.call_async()

    def test_connection(self) -> bool:
        """尝试列出指标（limit=1）以探测 bkn-backend 与 kn_id 是否可用。"""
        try:
            if not self.kn_id:
                logger.warning("BKNNativeMetricDataSource.test_connection: kn_id 为空")
                return False
            base = self.bkn_backend_base.rstrip("/")
            url = f"{base}/api/bkn-backend/v1/knowledge-networks/{self.kn_id}/metrics"
            params: Dict[str, Any] = {"limit": 1}
            if self.branch:
                params["branch"] = self.branch
            api = API(
                url=url,
                headers=self._merge_headers(),
                method=HTTPMethod.GET,
                params=params,
            )
            api.call()
            return True
        except Exception as e:
            logger.warning("BKNNativeMetricDataSource.test_connection failed: %s", e)
            return False

    async def aget_details(
        self,
        input_query: str = "",
        metric_num_limit: int = 5,
        input_dimension_num_limit: int = 30,
        metric_ids_override: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """与 DIPMetric.aget_details 对齐：返回供 text2metric 使用的指标 dict 列表（不做向量降维）。"""
        active = (
            list(metric_ids_override)
            if metric_ids_override is not None
            else list(self.metric_list)
        )
        active = [x for x in active if x]
        if not active:
            return []
        if metric_num_limit > 0 and len(active) > metric_num_limit:
            active = active[:metric_num_limit]

        raw_list = await self.aget_description_by_ids(active)
        details: List[Dict[str, Any]] = []
        for metric in raw_list:
            if not isinstance(metric, dict):
                continue
            adims = metric.get("analysis_dimensions") or []
            if (
                input_dimension_num_limit > 0
                and isinstance(adims, list)
                and len(adims) > input_dimension_num_limit
            ):
                m = dict(metric)
                m["analysis_dimensions"] = adims[:input_dimension_num_limit]
                details.append(m)
            else:
                details.append(metric)
        return details

    def get_details(
        self,
        input_query: str = "",
        metric_num_limit: int = 5,
        input_dimension_num_limit: int = 30,
        metric_ids_override: Optional[List[str]] = None,
    ) -> Any:
        return run_blocking(
            self.aget_details(
                input_query,
                metric_num_limit,
                input_dimension_num_limit,
                metric_ids_override,
            )
        )

    def convert_result_to_dataframe(
        self, metric_id: str, result: list
    ) -> Tuple[Optional[pd.DataFrame], dict]:
        """将指标序列结果转为 DataFrame（与 DIPMetric 行为一致，便于 text2metric 后处理）。"""
        try:
            rows: List[Dict[str, Any]] = []
            labels_mapping: Dict[str, str] = {}

            if not result:
                return None, {}

            details = self.get_description_by_ids(metric_id)
            if details:
                detail = details[0]
                fields = detail.get("analysis_dimensions", [])
                for field in fields:
                    if isinstance(field, dict) and field.get("name"):
                        labels_mapping[field["name"]] = (
                            field["display_name"]
                            if field.get("display_name")
                            else field["name"]
                        )

            labels_mapping["timestamp"] = "时间戳"
            labels_mapping["time_str"] = "时间"
            labels_mapping["value"] = "值"
            labels_mapping["growth_value"] = "增长值"
            labels_mapping["growth_rate"] = "增长率"

            for data in result:
                labels = data.get("labels", {}) if isinstance(data, dict) else {}
                times = data.get("times", []) if isinstance(data, dict) else []
                time_strs = data.get("time_strs", []) if isinstance(data, dict) else []
                values = data.get("values", []) if isinstance(data, dict) else []
                growth_values = data.get("growth_values", []) if isinstance(data, dict) else []
                growth_rates = data.get("growth_rates", []) if isinstance(data, dict) else []

                max_len = max(
                    len(times),
                    len(time_strs),
                    len(values),
                    len(growth_values),
                    len(growth_rates),
                )

                label_keys = list(labels.keys()) if isinstance(labels, dict) else []
                for i in range(max_len):
                    if labels:
                        row_data = {
                            **labels,
                            "timestamp": times[i] if i < len(times) else None,
                            "time_str": time_strs[i] if i < len(time_strs) else None,
                            "value": values[i] if i < len(values) else None,
                        }
                    else:
                        row_data = {
                            "timestamp": times[i] if i < len(times) else None,
                            "time_str": time_strs[i] if i < len(time_strs) else None,
                            "value": values[i] if i < len(values) else None,
                        }

                    if growth_values:
                        row_data["growth_value"] = (
                            growth_values[i] if i < len(growth_values) else None
                        )
                    if growth_rates:
                        row_data["growth_rate"] = (
                            growth_rates[i] if i < len(growth_rates) else None
                        )

                    rows.append(row_data)

            df = pd.DataFrame(rows)
            if df.empty:
                return df, labels_mapping

            drop_subset = [c for c in df.columns if c not in (["timestamp", "time_str"] + label_keys)]
            if drop_subset:
                df = df.dropna(subset=drop_subset, how="all")
            df = df.fillna("--")
            if "timestamp" in df.columns:
                df = df.sort_values(by="timestamp", ascending=True)
            df = df.rename(columns=labels_mapping)
            return df, labels_mapping
        except Exception as e:
            logger.error("BKNNativeMetricDataSource.convert_result_to_dataframe failed: %s", e)
            return None, {}

    def call(self, metric_id: str, data: dict, **kwargs) -> Any:
        """DIP 风格 query_params：内部转换为 ontology 请求体并查询。"""
        return run_blocking(self.acall(metric_id, data, **kwargs))

    async def acall(self, metric_id: str, data: dict, **kwargs) -> Any:
        fill_null = kwargs.get("fill_null")
        try:
            corrected = self.params_correction(data, metric_id)
            body = self.build_ontology_metric_query_body(metric_id, corrected)
            result = await self.aquery_metric_data(metric_id, body, fill_null=fill_null)
            datas = result.get("datas", [])
            data_frame, _dim_mapping = self.convert_result_to_dataframe(metric_id, datas)
            data_json: List[Dict[str, Any]] = []
            if data_frame is not None:
                data_json = data_frame.to_dict(orient="records")

            metric_detail = self.get_description_by_ids(metric_id)
            if metric_detail:
                for item in metric_detail:
                    if item.get("id") == metric_id:
                        result.update(
                            {
                                "unit": item.get("unit", ""),
                                "unit_type": item.get("unit_type", ""),
                            }
                        )
                        break

            result.pop("datas", None)
            result["data"] = data_json
            return result
        except AfDataSourceError:
            raise
        except Exception as e:
            logger.error("BKNNativeMetricDataSource.acall failed: %s", e)
            raise

    def set_data_list(self, data_list: List[str]):
        self.metric_list = list(data_list) if data_list else []

    def get_data_list(self) -> List[str]:
        return list(self.metric_list)

    def get_description(self, *args, **kwargs) -> Dict[str, Any]:
        return {
            "name": "BKN Native Metric",
            "type": "bkn_native_metric",
            "kn_id": self.kn_id,
            "branch": self.branch,
            "bkn_backend_base": self.bkn_backend_base,
            "ontology_query_base": self.ontology_query_base,
        }
