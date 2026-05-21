# -*- coding: utf-8 -*-
"""
ForecastingTool：Agent 可调用的「走势预测」工具。

- 编排语义对齐 `skills/smart-data-analysis/references/smart-forecasting.md`（STEP 4 结构化交付、严禁对用户输出 SQL、情景化区间等）。
- 实现形态参照 `app/tools/query_mind/text2metric.py`：继承 `LLMTool`、使用 `construct_final_answer` / `async_construct_final_answer`、
  可选会话缓存 `result_cache_key` 供下游（如报告组装）读取。
- **不替代**取数：`smart-data-query` / `text2sql` / `text2metric` 仍须由编排先完成；本工具消费其摘要或用户粘贴的依据包，由 LLM 生成预测草稿。
"""
from __future__ import annotations

import json
import re
import traceback
from textwrap import dedent
from typing import Any, Dict, List, Optional, Type

from langchain_core.callbacks import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.pydantic_v1 import BaseModel, Field

from app.errors import ForecastingToolError
from app.logs.logger import logger
from app.session import BaseChatHistorySession
from app.session.in_memory_session import InMemoryChatSession
from app.session.redis_session import RedisHistorySession
from app.tools.base import (
    LLMTool,
    ToolName,
    _TOOL_MESSAGE_KEY,
    async_construct_final_answer,
    construct_final_answer,
    parse_llm_from_model_factory,
)
from app.utils.common import run_blocking
from app.utils.llm import CustomChatOpenAI
from config import get_settings

_SETTINGS = get_settings()

_DESCS = {
    "tool_description": dedent(
        """\
        走势预测工具（smart-forecasting）：在已具备或可复用的「历史基数 + 数据解读 + 归因」摘要之上，
        生成 **情景化区间预测** 与 **局限性说明** 的结构化草稿（Markdown + JSON 小节）。
        **禁止**在输出中包含 SQL；数值区间须与输入锚点自洽。
        取数须由 text2sql / text2metric 等工具先行完成，本工具不直接查库。
        """
    ),
    "input": "用户预测诉求的自然语言描述（须含或可推断预测 horizon、指标口径）",
    "mode": "A=执行型（默认）：需提供 history_anchors_json 及尽量提供解读/归因摘要；"
    "B=仅消费型：须在 data_interpretation_delivery 与 attribution_delivery 中提供完整依据原文或等价摘要",
}


def _create_session(session_type: str) -> BaseChatHistorySession:
    if session_type == "redis":
        return RedisHistorySession()
    if session_type == "in_memory":
        return InMemoryChatSession()
    raise ValueError(f"不支持的 session_type: {session_type}")


_FORECASTING_SYSTEM = dedent(
    """\
    你是「走势预测」写作助手，须严格遵守内部规范 smart-forecasting（与 smart-data-analysis 总编排一致）。

    ## 硬约束（MUST）
    1. 对用户可见内容 **严禁** 出现 SQL 语句、`SELECT`/`FROM`/`WHERE` 等类 SQL 片段、以及 Markdown ```sql 围栏。
    2. 所有 **历史事实数字**（基数、同比、表内计数）只能来自用户提供的「历史锚点」或「解读/归因交付」；**禁止编造**与输入不一致的数值。
    3. 预测为 **情景化区间 + 假设**，禁止表述为「官方统计预报」或唯一精确点值；须写清 **保守 / 中性 / 积极**（或用户给定档名）及 **关键假设**。
    4. 若输入缺少历史锚点且模式为 A，仍须生成 JSON，但在 `validation_notes` 中列出 **最小补齐清单**，且 `forecast_markdown` 中须明确「依据不足、区间不可承诺」类声明。
    5. 输出 **仅** 为单个 JSON 对象（不要 Markdown 围栏包裹整个 JSON），字段见用户消息中的 schema 说明。

    ## 输出结构（章节语义对齐 smart-forecasting「输出模板」0～6）
    - section_0: 预测任务与口径卡片 + 历史基数表（Markdown 字符串）
    - section_1: 历史规律摘要（解读 + 归因，Markdown）
    - section_2: 预测模型基础（透明规则：历史基数复述、增长与结构模式定性，Markdown）
    - section_3: 预测 horizon 情景方案（保守/中性/积极等，Markdown）
    - section_4: 数量预测表（Markdown 表格字符串，含「预测场景|预计量级|相对基准|关键假设」类列）
    - section_5: 趋势特征预测（定性条款，Markdown）
    - section_6: 局限性说明（Markdown）
    - forecast_markdown: 将以上各节按标题顺序拼接成一份完整 Markdown（便于直接展示）
    - evidence_index: 数组，每项含 ref（如子问题编号、锚点 period）、note（一句话）
    - validation_notes: 字符串数组，自检项（如「区间与假设绑定」「无 SQL」）
    """
)


_JSON_SHAPE_HINT = dedent(
    """\
    请只输出 JSON，形状严格如下（字符串值内使用 \\n 换行，表格用 Markdown 管道表语法内嵌于字符串中）：
    {
      "section_0": "...",
      "section_1": "...",
      "section_2": "...",
      "section_3": "...",
      "section_4": "...",
      "section_5": "...",
      "section_6": "...",
      "forecast_markdown": "...",
      "evidence_index": [{"ref": "", "note": ""}],
      "validation_notes": [""]
    }
    """
)


class SmartForecastingInput(BaseModel):
    input: str = Field(description=_DESCS["input"])
    mode: str = Field(
        default="A",
        description=_DESCS["mode"],
    )
    action: str = Field(
        default="forecast",
        description="固定为 forecast：生成预测草稿",
    )
    kn_id: Optional[str] = Field(
        default="",
        description="业务知识网络 ID（仅写入依据索引/口径卡片，本工具不发起取数）",
    )
    horizon: Optional[str] = Field(
        default="",
        description="预测期描述，如「2026 全年」「2026-Q1」",
    )
    indicator_summary: Optional[str] = Field(
        default="",
        description="待预测指标与主体/地域/类型范围的一句话口径",
    )
    history_anchors_json: Optional[str] = Field(
        default="",
        description='历史基数 JSON 字符串，如 [{"period":"2024","value":36,"note":"基准年"}]',
    )
    data_interpretation_delivery: Optional[str] = Field(
        default="",
        description="数据解读（data_interpretation）交付摘要或原文摘录",
    )
    attribution_delivery: Optional[str] = Field(
        default="",
        description="归因分析（attribution_analysis）交付摘要或原文摘录",
    )
    dataview_context: Optional[str] = Field(
        default="",
        description="STEP1 收敛信息：dataview_id、视图业务名、字段说明等业务话摘要",
    )
    extra_info: Optional[str] = Field(
        default="",
        description="附加背景（非 SQL），如用户补充约束",
    )


class ForecastingTool(LLMTool):
    """LLM 驱动的走势预测草稿生成工具。"""

    name: str = ToolName.from_smart_forecasting.value
    description: str = _DESCS["tool_description"]
    args_schema: Type[BaseModel] = SmartForecastingInput
    session_type: str = "redis"
    session_id: str = ""
    session: Optional[BaseChatHistorySession] = None
    api_mode: bool = False
    llm: Any = None
    inner_llm: Optional[Dict[str, Any]] = None
    temperature: float = 0.2
    max_tokens: int = 4096

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.inner_llm = kwargs.pop("inner_llm", None)
        incoming_llm = kwargs.pop("llm", None)
        super().__init__(*args, **kwargs)
        if self.session is None:
            self.session = _create_session(self.session_type)
        if incoming_llm is not None:
            self.llm = incoming_llm
        if self.llm is None:
            self.llm = self._build_llm(self.inner_llm or {})

    def _build_llm(self, inner: Dict[str, Any]) -> CustomChatOpenAI:
        llm_dict = parse_llm_from_model_factory(inner or {})
        llm_dict.setdefault("temperature", self.temperature)
        if self.max_tokens:
            llm_dict["max_tokens"] = self.max_tokens
        return CustomChatOpenAI(**llm_dict)

    def _parse_history_anchors(self, raw: str) -> List[Dict[str, Any]]:
        if not (raw or "").strip():
            return []
        try:
            data = json.loads(raw)
            return data if isinstance(data, list) else []
        except json.JSONDecodeError as e:
            raise ForecastingToolError(
                detail=f"history_anchors_json 不是合法 JSON: {e}",
                reason="请传入 JSON 数组字符串，如 [{\"period\":\"2024\",\"value\":36}]",
            ) from e

    def _build_human_payload(self, **fields: Any) -> str:
        parts = [
            "## 用户预测任务",
            fields.get("input", "").strip(),
            "\n## 模式",
            fields.get("mode", "A"),
            "\n## kn_id",
            fields.get("kn_id", "") or "(未填)",
            "\n## 预测 horizon",
            fields.get("horizon", "") or "(未填，请从任务中推断并在 section_0 写明)",
            "\n## 指标与口径摘要",
            fields.get("indicator_summary", "") or "(未填)",
            "\n## 历史锚点（JSON，已解析校验）",
            json.dumps(fields.get("_anchors", []), ensure_ascii=False),
            "\n## 数据解读交付摘录",
            fields.get("data_interpretation_delivery", "") or "(空)",
            "\n## 归因分析交付摘录",
            fields.get("attribution_delivery", "") or "(空)",
            "\n## 数据视图上下文（STEP1）",
            fields.get("dataview_context", "") or "(空)",
            "\n## 附加说明",
            fields.get("extra_info", "") or "(无)",
            "\n",
            _JSON_SHAPE_HINT,
        ]
        return "\n".join(parts)

    @staticmethod
    def _strip_code_fence(text: str) -> str:
        t = text.strip()
        m = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", t, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return t

    @classmethod
    def _parse_forecast_json(cls, text: str) -> Dict[str, Any]:
        cleaned = cls._strip_code_fence(text)
        try:
            obj = json.loads(cleaned)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            logger.warning("ForecastingTool: 主 JSON 解析失败，尝试截取首个 { ... } 块")
        try:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                obj = json.loads(cleaned[start : end + 1])
                if isinstance(obj, dict):
                    return obj
        except json.JSONDecodeError as e:
            logger.error(traceback.format_exc())
            raise ForecastingToolError(
                detail={"error": str(e), "raw_preview": cleaned[:2000]},
                reason="模型未返回合法 JSON，请重试或检查模型输出",
            ) from e
        raise ForecastingToolError(
            detail={"raw_preview": cleaned[:2000]},
            reason="模型输出中未找到 JSON 对象",
        )

    async def _ainvoke_llm(self, human_content: str) -> str:
        assert self.llm is not None
        messages = [
            SystemMessage(
                content=_FORECASTING_SYSTEM,
                additional_kwargs={_TOOL_MESSAGE_KEY: self.name},
            ),
            HumanMessage(
                content=human_content,
                additional_kwargs={_TOOL_MESSAGE_KEY: self.name},
            ),
        ]
        resp = await self.llm.ainvoke(messages)
        return resp.content if hasattr(resp, "content") else str(resp)

    def _validate_mode_inputs(
        self,
        mode: str,
        anchors: List[Dict[str, Any]],
        interp: str,
        attr: str,
    ) -> List[str]:
        warns: List[str] = []
        mode_u = (mode or "A").strip().upper()
        if mode_u == "B":
            if not (interp or "").strip() or not (attr or "").strip():
                warns.append("模式 B 建议同时提供 data_interpretation_delivery 与 attribution_delivery 完整依据。")
        else:
            if not anchors:
                warns.append("模式 A 未提供 history_anchors_json：区间可信度下降，须在局限性中声明。")
            if not (interp or "").strip():
                warns.append("未提供数据解读摘要：历史规律摘要可能不足。")
            if not (attr or "").strip():
                warns.append("未提供归因摘要：情景假设可验证性不足。")
        return warns

    def _assemble_output(
        self,
        parsed: Dict[str, Any],
        result_cache_key: str,
        warnings: List[str],
    ) -> Dict[str, Any]:
        forecast_md = (parsed.get("forecast_markdown") or "").strip()
        if not forecast_md:
            # 拼接各节
            chunks = []
            for i in range(7):
                key = f"section_{i}"
                if parsed.get(key):
                    chunks.append(str(parsed[key]))
            forecast_md = "\n\n".join(chunks) if chunks else json.dumps(parsed, ensure_ascii=False)

        notes = list(parsed.get("validation_notes") or [])
        notes.extend(warnings)

        out = {
            "title": "走势预测（smart-forecasting）",
            "forecast_markdown": forecast_md,
            "sections": {f"section_{i}": parsed.get(f"section_{i}", "") for i in range(7)},
            "evidence_index": parsed.get("evidence_index") or [],
            "validation_notes": notes,
            "result_cache_key": result_cache_key,
            "tool": self.name,
            "message": "预测草稿已生成；请与上游取数/解读/归因核对后再对用户展示。全文禁止包含 SQL。",
        }
        return {"output": out, "full_output": {"raw_sections": parsed}}

    def _process(
        self,
        input: str,
        mode: str = "A",
        action: str = "forecast",
        kn_id: str = "",
        horizon: str = "",
        indicator_summary: str = "",
        history_anchors_json: str = "",
        data_interpretation_delivery: str = "",
        attribution_delivery: str = "",
        dataview_context: str = "",
        extra_info: str = "",
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        return run_blocking(
            self._aprocess(
                input,
                mode,
                action,
                kn_id,
                horizon,
                indicator_summary,
                history_anchors_json,
                data_interpretation_delivery,
                attribution_delivery,
                dataview_context,
                extra_info,
                run_manager,
            )
        )

    async def _aprocess(
        self,
        input: str,
        mode: str = "A",
        action: str = "forecast",
        kn_id: str = "",
        horizon: str = "",
        indicator_summary: str = "",
        history_anchors_json: str = "",
        data_interpretation_delivery: str = "",
        attribution_delivery: str = "",
        dataview_context: str = "",
        extra_info: str = "",
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        _ = action, run_manager
        if not (input or "").strip():
            raise ForecastingToolError(detail="input 不能为空", reason="请传入清晰的预测任务描述")

        anchors = self._parse_history_anchors(history_anchors_json or "")
        warns = self._validate_mode_inputs(
            mode, anchors, data_interpretation_delivery, attribution_delivery
        )

        human = self._build_human_payload(
            input=input.strip(),
            mode=mode,
            kn_id=kn_id,
            horizon=horizon,
            indicator_summary=indicator_summary,
            data_interpretation_delivery=data_interpretation_delivery,
            attribution_delivery=attribution_delivery,
            dataview_context=dataview_context,
            extra_info=extra_info,
            _anchors=anchors,
        )

        try:
            raw_text = await self._ainvoke_llm(human)
        except Exception as e:
            logger.error(traceback.format_exc())
            raise ForecastingToolError(
                detail=str(e),
                reason="LLM 调用失败",
            ) from e

        parsed = self._parse_forecast_json(raw_text)

        if self.session:
            payload = {
                "forecast": parsed,
                "forecast_markdown": parsed.get("forecast_markdown", ""),
                "warnings": warns,
            }
            self.session.add_agent_logs(self._result_cache_key, logs=payload)

        return self._assemble_output(parsed, self._result_cache_key, warns)

    @construct_final_answer
    def _run(
        self,
        input: str,
        mode: str = "A",
        action: str = "forecast",
        kn_id: str = "",
        horizon: str = "",
        indicator_summary: str = "",
        history_anchors_json: str = "",
        data_interpretation_delivery: str = "",
        attribution_delivery: str = "",
        dataview_context: str = "",
        extra_info: str = "",
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        return self._process(
            input,
            mode,
            action,
            kn_id,
            horizon,
            indicator_summary,
            history_anchors_json,
            data_interpretation_delivery,
            attribution_delivery,
            dataview_context,
            extra_info,
            run_manager,
        )

    @async_construct_final_answer
    async def _arun(
        self,
        input: str,
        mode: str = "A",
        action: str = "forecast",
        kn_id: str = "",
        horizon: str = "",
        indicator_summary: str = "",
        history_anchors_json: str = "",
        data_interpretation_delivery: str = "",
        attribution_delivery: str = "",
        dataview_context: str = "",
        extra_info: str = "",
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> Dict[str, Any]:
        return await self._aprocess(
            input,
            mode,
            action,
            kn_id,
            horizon,
            indicator_summary,
            history_anchors_json,
            data_interpretation_delivery,
            attribution_delivery,
            dataview_context,
            extra_info,
            run_manager,
        )


__all__ = ["ForecastingTool", "SmartForecastingInput"]
