# -*- coding: utf-8 -*-
"""数据理解等工具：从 params.config / params.llm 合并大模型参数。"""
from __future__ import annotations

from typing import Any, Dict, Optional

from config import get_settings

_LLM_KEYS = ("name", "model_name", "temperature", "max_tokens")


def _pick_llm_fields(source: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not isinstance(source, dict):
        return out
    for key in _LLM_KEYS:
        if key in source and source[key] is not None:
            out[key] = source[key]
    return out


def _settings_llm_defaults() -> Dict[str, Any]:
    s = get_settings()
    out: Dict[str, Any] = {}
    name = (getattr(s, "DATA_UNDERSTAND_LLM_NAME", None) or "").strip()
    if name:
        out["name"] = name
    temp = getattr(s, "DATA_UNDERSTAND_LLM_TEMPERATURE", None)
    if temp is not None and temp != "":
        try:
            out["temperature"] = float(temp)
        except (TypeError, ValueError):
            pass
    max_tok = getattr(s, "DATA_UNDERSTAND_LLM_MAX_TOKENS", None)
    if max_tok is not None and max_tok != "":
        try:
            out["max_tokens"] = int(max_tok)
        except (TypeError, ValueError):
            pass
    return out


def merge_llm_from_config(params: Dict[str, Any]) -> None:
    """
    将 config 中的大模型参数合并到 params["llm"]。

    支持两种写法（可并存，内层 config.llm 优先于顶层扁平字段）：
      config.name / config.temperature / config.max_tokens
      config.llm: { name, temperature, max_tokens }

    优先级（后者覆盖前者）：Settings 默认 < config < 顶层 params.llm
    """
    config = params.get("config") or {}
    from_config: Dict[str, Any] = {}
    if isinstance(config, dict):
        nested = config.get("llm")
        if isinstance(nested, dict):
            from_config.update(_pick_llm_fields(nested))
        flat = _pick_llm_fields(config)
        for k, v in flat.items():
            if k not in from_config:
                from_config[k] = v

    merged: Dict[str, Any] = {}
    merged.update(_settings_llm_defaults())
    merged.update(from_config)
    explicit = params.get("llm")
    if isinstance(explicit, dict):
        merged.update(_pick_llm_fields(explicit))

    if merged:
        params["llm"] = merged


def build_data_understand_llm_dict(params: Dict[str, Any]) -> Dict[str, Any]:
    """构造 CustomChatOpenAI 所需的 llm_dict（含 model_name / temperature / max_tokens）。"""
    from config import settings

    merge_llm_from_config(params)
    llm_out = params.get("llm") or {}

    llm_dict: Dict[str, Any] = {
        "model_name": settings.TOOL_LLM_MODEL_NAME,
        "openai_api_key": settings.TOOL_LLM_OPENAI_API_KEY,
        "openai_api_base": settings.TOOL_LLM_OPENAI_API_BASE,
        "max_tokens": 20000,
        "temperature": 0,
    }

    model_name = llm_out.get("name") or llm_out.get("model_name")
    if model_name:
        llm_dict["model_name"] = model_name
    if llm_out.get("max_tokens") is not None:
        llm_dict["max_tokens"] = llm_out["max_tokens"]
    if llm_out.get("temperature") is not None:
        llm_dict["temperature"] = llm_out["temperature"]

    return llm_dict
