# -*- coding: utf-8 -*-
# @Author:  Xavier.chen@aishu.cn
# @Date: 2024-08-26
import copy
import json
import traceback
from typing import Any, Dict, Optional, Type, List

from langchain.callbacks.manager import (AsyncCallbackManagerForToolRun,
                                         CallbackManagerForToolRun)

from langchain.pydantic_v1 import BaseModel, Field, PrivateAttr
from fastapi import Body

from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate
)
from langchain_core.messages import SystemMessage, HumanMessage

from app.errors import Text2DIPMetricError
from app.logs.logger import logger
from app.tools.query_mind.prompts.text2dip_metric_prompt import Text2DIPMetricPrompt
from app.tools.query_mind.prompts.text2metric_prompt.rewrite_query import RewriteMetricQueryPrompt
from app.parsers.base import BaseJsonParser

from app.session import BaseChatHistorySession
from app.session.redis_session import RedisHistorySession
from app.session.in_memory_session import InMemoryChatSession
from app.tools.base import construct_final_answer, async_construct_final_answer
from app.tools.base import LLMTool, ToolName
from app.tools.base import _TOOL_MESSAGE_KEY
from config import get_settings
from app.tools.base import api_tool_decorator
from app.utils.llm import CustomChatOpenAI
from app.datasource.bkn_native_metric import BKNNativeMetricDataSource
from app.tools.base import parse_llm_from_model_factory
from app.utils.common import run_blocking
from app.utils.model_types import ModelType4Prompt
def CreateSession(session_type: str):
    """创建会话对象，使用本地的 settings 配置"""
    if session_type == "redis":
        return RedisHistorySession()
    elif session_type == "in_memory":
        return InMemoryChatSession()
    else:
        raise ValueError(f"不支持的 session_type: {session_type}")

_SETTINGS = get_settings()

_DESCS = {
    "tool_description": {
        "cn": (
            "根据文本，以及DIP指标的列表来生成指标调用参数，每次工具只能调用一个指标但是可以设置不同的查询条件。"
            "如果获取的数据太长的话，只返回局部数据，全部数据在缓存中。"
            "结果中有一个 data_desc 的对象来记录返回数据条数和实际结果条数，请告知用户查看详细数据，应用程序会获取。"
        ),
        "en": (
            "call corresponding DIP indicators based on user input text, "
            "only one indicator at a time, if the question contains multiple indicators, "
            "please call multiple times, the result has a data_desc object to record "
            "the number of returned data and the actual number of results, "
            "please tell the user to check the detailed data, the application will get it."
        ),
    },
    "chat_history": {
        "cn": "对话历史",
        "en": "chat history",
    },
    "input": {
        "cn": "一个清晰完整的文本",
        "en": "A clear and complete question",
    },
    "action": {
        "cn": "操作类型：query 执行指标查询（默认）",
        "en": "Action type: query to execute metric query (default)",
    },
    "desc_from_datasource": {
        "cn": "\n- 包含的指标信息：{desc}",
        "en": "\nThe detailed description of the indicator: \n{desc}",
    }
}


class DIPMetricDescSchema(BaseModel):
    id: str = Field(description="指标的 id, 格式为 str")
    name: str = Field(description="指标的名称")
    metric_type: str = Field(description="指标的类型")
    query_type: str = Field(description="查询类型")
    unit: str = Field(description="单位")


class Text2DIPMetricInput(BaseModel):
    input: str = Field(description=_DESCS["input"]["cn"])
    action: str = Field(
        default="query",
        description=_DESCS["action"]["cn"]
    )
    specified_metric_id: Optional[str] = Field(
        default="",
        description=(
            "用户指定的指标 id（DIP 指标模型 id）。若填写：仅加载该指标元数据，"
            "由 LLM 根据问题生成 query_params，再调用数据模型执行查询（见 BKN/数据模型指标查询契约）；"
            "留空则由模型从候选指标中选择。"
        ),
    )

    extra_info: Optional[str] = Field(
        default="",
        description="附加信息，但不是知识增强的信息"
    )


class Text2DIPMetricInputWithMetricList(Text2DIPMetricInput):
    metric_list: List[DIPMetricDescSchema] = Field(
        default=[],
        description=(
            "指标列表，注意指标指的一个数据源，不是字段信息，当已经初始化过虚拟视图列表时，"
            "不需要填写该参数。如果需要填写该参数，请确保`上下文缓存的数据资源中存在`，"
            f"不要随意生成。注意参数一定要准确。格式为 {DIPMetricDescSchema.schema_json(ensure_ascii=False)}"
        )
    )


class Text2MetricTool(LLMTool):
    name: str = ToolName.from_text2metric.value
    description: str = _DESCS["tool_description"]["cn"]
    background: str = ""
    args_schema: Type[BaseModel] = Text2DIPMetricInput
    bkn_metric: Optional[BKNNativeMetricDataSource] = None
    retry_times: int = 3
    session_type: str = "redis"
    session_id: Optional[str] = ""
    session: Optional[BaseChatHistorySession] = None
    get_desc_from_datasource: bool = False  # 是否从数据源获取描述
    with_sample_data: bool = True   # 是否从逻辑视图中获取样例数据
    dimension_num_limit: int = int(_SETTINGS.TEXT2METRIC_DIMENSION_NUM_LIMIT)
    recall_top_k: int = int(_SETTINGS.INDICATOR_RECALL_TOP_K)
    rewrite_query: bool = bool(_SETTINGS.INDICATOR_REWRITE_QUERY)  # 是否重写指标查询语句
    model_type: str = _SETTINGS.TEXT2METRIC_MODEL_TYPE
    language: str = "cn"  # 语言设置
    return_record_limit: int = _SETTINGS.RETURN_RECORD_LIMIT
    return_data_limit: int = _SETTINGS.RETURN_DATA_LIMIT
    api_mode: bool = False  # 是否为 API 模式
    force_limit: int = _SETTINGS.TEXT2METRIC_FORCE_LIMIT  # 限制指标查询的行数

    _initial_metric_ids: List[str] = PrivateAttr(default=[])  # 工具初始化时设置的指标id列表
    _result_cache_key: str = PrivateAttr(default="")  # 结果缓存键

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if kwargs.get("session") is None:
            self.session = CreateSession(self.session_type)

        if self.bkn_metric and self.bkn_metric.get_data_list():
            self._initial_metric_ids = self.bkn_metric.get_data_list()
        else:
            self.args_schema = Text2DIPMetricInputWithMetricList

    _METRIC_IDS_MISSING_REASON = (
        "请在 data_source.metric_list 中传入至少一个指标 id，"
        "或设置 data_source.specified_metric_id 指定单一指标"
    )

    @staticmethod
    def _parse_metric_list_from_data_source(metric_list: Any) -> List[str]:
        """解析 data_source.metric_list，返回去空后的指标 id 列表。"""
        if not metric_list:
            return []
        if isinstance(metric_list, str):
            items = metric_list.split(",")
        elif isinstance(metric_list, list):
            if not metric_list:
                return []
            first = metric_list[0]
            if isinstance(first, str):
                items = metric_list
            elif isinstance(first, dict):
                items = [item.get("metric_model_id", "") for item in metric_list]
            else:
                logger.error(f"指标列表格式不正确: {metric_list}")
                raise Text2DIPMetricError(
                    detail="指标列表格式不正确",
                    reason="指标列表格式不正确",
                )
        else:
            logger.error(f"指标列表格式不正确: {metric_list}")
            raise Text2DIPMetricError(
                detail="指标列表格式不正确",
                reason="指标列表格式不正确",
            )
        return [str(x).strip() for x in items if x is not None and str(x).strip()]

    @staticmethod
    def _ensure_metric_ids_configured(
        metric_ids: List[str],
        specified_metric_id: str = "",
    ) -> None:
        """metric_list 与 specified_metric_id 不能同时为空。"""
        smid = (specified_metric_id or "").strip()
        ids = [x for x in (metric_ids or []) if x]
        if not ids and not smid:
            raise Text2DIPMetricError(
                detail="未配置候选指标",
                reason=Text2MetricTool._METRIC_IDS_MISSING_REASON,
            )

    def _validate_specified_metric_id(self, specified_metric_id: str) -> str:
        """若用户指定指标，校验其是否在当前 bkn_metric.metric_list 内（列表非空时）。"""
        smid = (specified_metric_id or "").strip()
        if not smid or not self.bkn_metric:
            return ""
        allowed = [x for x in (self.bkn_metric.get_data_list() or []) if x]
        if allowed and smid not in allowed:
            raise Text2DIPMetricError(
                detail=f"指定的指标 id 不在当前任务可用范围内: {smid}",
                reason="请从已配置的指标列表中选择，或留空 specified_metric_id 由模型从候选集中选择",
            )
        return smid

    def _normalize_query_type_for_prompt(self, metric_details: list) -> str:
        """与 Text2DIPMetricPrompt 模板中 promsql/sql 分支对齐。"""
        if not metric_details or not isinstance(metric_details[0], dict):
            return "sql"
        raw = (metric_details[0].get("query_type") or "sql")
        if isinstance(raw, str):
            r = raw.strip().lower()
            if r in ("promql", "promsql", "prom"):
                return "promsql"
        return "sql"

    def _init_dip_metric_details_and_samples(
        self, input_question="", specified_metric_id: str = "",
    ):
        """初始化 BKN 指标详情和样例数据"""
        coroutine = self._ainit_dip_metric_details_and_samples(
            input_question, specified_metric_id=specified_metric_id,
        )
        return run_blocking(coroutine)

    async def _ainit_dip_metric_details_and_samples(
        self, input_question="", specified_metric_id: str = "",
    ):
        """异步初始化 BKN 指标详情和样例数据"""
        try:
            if not self.bkn_metric:
                logger.warning("BKN 指标数据源未初始化")
                return

            # 获取指标详情
            metric_details = []
            sample_data = {
                "mapping": [],
                "data": []
            }

            smid = (specified_metric_id or "").strip()
            if smid:
                metric_ids_override = [smid]
                logger.info(
                    "用户已指定指标 %s：仅加载该指标详情并生成 query_params",
                    smid,
                )
            else:
                metric_ids_override = None

            # 异步获取可用指标列表
            details = await self.bkn_metric.aget_details(
                input_question,
                self.recall_top_k,
                self.dimension_num_limit,
                metric_ids_override=metric_ids_override,
            )
            if smid and not details:
                raise Text2DIPMetricError(
                    detail=f"无法加载指定指标 {smid} 的元数据",
                    reason="请确认指标 id 正确，且数据模型服务可返回该指标详情",
                )
            if details:
                for metric in details:
                    metric_details.append({
                        "id": metric.get("id"),
                        "name": metric.get("name"),
                        "comment": metric.get("comment"),
                        "formula_config": metric.get("formula_config"),
                        "analysis_dimensions": metric.get("analysis_dimensions"),
                        "date_field": metric.get("date_field"),
                        "unit_type": metric.get("unit_type"),
                        "unit": metric.get("unit"),
                        "data_source": metric.get("data_source", {})
                    })
                logger.info(f"异步获取到 {len(metric_details)} 个指标详情")

            if self.with_sample_data and metric_details:

                for metric in metric_details:
                    data_source = metric.get("data_source", {})
                    if not data_source:
                        continue

                    sample_data["mapping"].append({
                        "metric_id": metric.get("id"),
                        "data_view_id": metric.get("data_source", {}).get("id"),
                    })
                    data_view_id = metric.get("data_source", {}).get("id")

                    if data_view_id in sample_data:
                        continue

                    svc = getattr(self.bkn_metric, "service", None)
                    if svc is None:
                        continue
                    sample = await svc.get_view_data_preview_async(
                        data_view_id,
                        fields=metric.get("analysis_dimensions")
                    )
                    sample_data["data"].append({
                        "view_id": data_view_id,
                        "data": sample.get("entries", [])
                    })

            return metric_details, sample_data

        except Exception as e:
            logger.error(f"异步初始化 BKN 指标详情和样例数据失败: {e}")
            raise e

    def _config_chain(
        self,
        metric_details: list,
        samples: list,
        errors: dict,
        background: str = "",
        fixed_metric_id: str = "",
    ):
        """配置 LLM 链"""
        try:
            # 获取 prompt
            system_prompt = Text2DIPMetricPrompt(
                metrics=metric_details,
                samples=samples,
                background=background,
                errors=errors,
                fixed_metric_id=(fixed_metric_id or "").strip(),
                query_type=self._normalize_query_type_for_prompt(metric_details),
            )

            logger.debug(f"text2metric -> system_prompt: {system_prompt.render()}")

            if self.model_type == ModelType4Prompt.DEEPSEEK_R1.value:
                prompt = ChatPromptTemplate.from_messages(
                    [
                        HumanMessage(
                            content="下面是你的任务，请务必牢记" + system_prompt.render(),
                            additional_kwargs={_TOOL_MESSAGE_KEY: "text2metric"}
                        ),
                        HumanMessagePromptTemplate.from_template("{input}")
                    ]
                )
            else:
                prompt = ChatPromptTemplate.from_messages(
                    [
                        SystemMessage(
                            content=system_prompt.render(),
                            additional_kwargs={_TOOL_MESSAGE_KEY: "text2metric"}
                        ),
                        HumanMessagePromptTemplate.from_template("{input}")
                    ]
                )

            chain = (
                prompt
                | self.llm
            )
            return chain
        except Exception as e:
            logger.error(f"配置 LLM 链失败: {e}")
            raise e

    def _add_extra_info(self, extra_info: str = ""):
        """将 extra_info 拼入 LLM 背景。"""
        background = self.background

        if extra_info:
            background += f"\n额外信息：{extra_info}"

        return background

    def _config_rewrite_metric_query_chain(self, question: str, background: str, metrics: list, samples: Any):
        """配置重写指标查询语句的 LLM 链"""
        prompt = RewriteMetricQueryPrompt(
            question=question,
            metrics=metrics,
            samples=samples,
            language=self.language,
            background=background
        )

        if self.model_type == ModelType4Prompt.DEEPSEEK_R1.value:
            messages = [
                HumanMessage(content=prompt.render(escape_braces=False), additional_kwargs={
                             _TOOL_MESSAGE_KEY: "text2metric_rewrite_query"}),
                HumanMessage(content=question)
            ]
        else:
            messages = [
                SystemMessage(content=prompt.render(escape_braces=False), additional_kwargs={
                              _TOOL_MESSAGE_KEY: "text2metric_rewrite_query"}),
                HumanMessage(content=question)
            ]

        chain = self.llm | BaseJsonParser()
        return chain, messages

    async def _arewrite_metric_query(self, question: str, background: str, metrics: list, samples: Any):
        """异步重写指标查询语句"""
        chain, messages = self._config_rewrite_metric_query_chain(question, background, metrics, samples)
        new_question = await chain.ainvoke(messages)

        # 输出是字符串，帮助后续问题理解
        return json.dumps(new_question, ensure_ascii=False)

    def _rewrite_metric_query(self, question: str, background: str, metrics: list, samples: Any):
        """同步重写指标查询语句"""
        chain, messages = self._config_rewrite_metric_query_chain(question, background, metrics, samples)
        new_question = chain.invoke(messages)

        return json.dumps(new_question, ensure_ascii=False)

    @construct_final_answer
    def _run(
        self,
        input: str,
        action: str = "query",
        specified_metric_id: str = "",
        extra_info: str = "",
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ):
        """同步运行"""
        return self._process_query(
            input,
            action,
            specified_metric_id,
            extra_info,
            run_manager,
        )

    @async_construct_final_answer
    async def _arun(
        self,
        input: str,
        action: str = "query",
        specified_metric_id: str = "",
        extra_info: str = "",
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ):
        """异步运行"""
        return await self._aprocess_query(
            input,
            action,
            specified_metric_id,
            extra_info,
            run_manager,
        )

    def _process_query(
        self,
        input: str,
        action: str = "query",
        specified_metric_id: str = "",
        extra_info: str = "",
        run_manager=None,
    ):
        """处理查询，参考 text2metric.py 的实现"""
        try:
            if not input or not input.strip():
                raise Text2DIPMetricError(detail="输入问题不能为空", reason="输入问题不能为空")

            fixed_metric_id = self._validate_specified_metric_id(specified_metric_id)
            self._ensure_metric_ids_configured(
                self.bkn_metric.get_data_list() if self.bkn_metric else [],
                fixed_metric_id,
            )

            # 添加额外信息
            background = self._add_extra_info(extra_info)

            # 初始化指标详情和样例
            metric_details, sample_data = self._init_dip_metric_details_and_samples(
                input, specified_metric_id=fixed_metric_id,
            )

            errors = {}
            res = {}
            res_for_llm = {}
            llm_res = {}  # Initialize before retry loop to avoid undefined variable
            call_res = {}

            # 重写指标查询语句，提高指标查询的准确性
            question = input
            if self.rewrite_query:
                question = self._rewrite_metric_query(input, background, metric_details, sample_data)
                logger.debug(f"重写后的指标查询语句->: {question}")

            for i in range(self.retry_times):
                logger.debug("============" * 10)
                logger.debug(f"{i + 1} times to process DIP metric query......")
                try:
                    llm_res, call_res = {}, {}  # Reset for each retry

                    # 配置 LLM 链
                    chain = self._config_chain(
                        metric_details=metric_details,
                        samples=sample_data,
                        errors=errors,
                        background=background,
                        fixed_metric_id=fixed_metric_id,
                    )

                    # 调用 LLM
                    response = chain.invoke({"input": question})

                    # 解析响应
                    llm_res = self._parse_response(response)

                    if fixed_metric_id:
                        llm_res["metric_id"] = fixed_metric_id

                    # 获取指标ID和查询参数
                    metric_id = llm_res.get("metric_id", "")
                    param = llm_res.get("query_params", {})

                    if metric_id == "":
                        raise Text2DIPMetricError(llm_res.get("explanation", "指标ID为空"))

                    # 添加引用信息
                    res["cites"] = [
                        {
                            "id": metric_id,
                            "name": metric_id,
                            "type": "metric",
                            "description": "BKN 指标"
                        }
                    ]

                    res.update(llm_res)
                    res_for_llm = res.copy()

                    # 执行查询
                    if metric_id and param:
                        call_res = self._execute_query(metric_id, param)
                        logger.info(f"BKN 指标调用结果: {call_res}")

                        if call_res.get("error"):
                            raise Text2DIPMetricError(call_res["error"])

                        # 先拷贝一份给大模型的结果
                        res_for_llm = res.copy()

                        # 处理执行结果
                        execution_result, raw_result = self._process_execution_result(call_res)

                        res_for_llm.update(execution_result)
                        res.update(raw_result)

                        # 设置标题
                        if res.get("title", "") == "":
                            res["title"] = input

                        if not raw_result.get("data"):
                            res_for_llm.pop("result_cache_key", None)
                            res_for_llm["message"] = "查询结果为空"

                            res.pop("result_cache_key")
                            break

                        # 将完整结果写入缓存, 如果数据为空，则不写入缓存
                        if self.session and raw_result.get("data"):
                            self.session.add_agent_logs(
                                self._result_cache_key,
                                logs=res
                            )

                        # 如果成功获取结果，跳出重试循环
                        break

                except Exception as e:
                    logger.error(f"第 {i + 1} 次处理查询失败: {e}")
                    logger.error(f"错误详情: {traceback.format_exc()}")
                    errors[f"error_{i+1}"] = str(e)

                    # 如果是最后一次重试，抛出异常
                    if i == self.retry_times - 1:
                        logger.error(f"处理查询失败，已重试 {self.retry_times} 次")
                        raise Text2DIPMetricError(f"处理查询失败，已重试 {self.retry_times} 次: {errors}")

                    # 继续下一次重试
                    continue

            if self.api_mode:
                return self._build_api_mode_return(res_for_llm, res)
            else:
                return res

        except Text2DIPMetricError:
            raise
        except Exception as e:
            logger.error(f"处理查询失败: {e}")
            raise Text2DIPMetricError(f"处理查询失败: {e}")

    async def _aprocess_query(
        self,
        input: str,
        action: str = "query",
        specified_metric_id: str = "",
        extra_info: str = "",
        run_manager=None,
    ):
        """异步处理查询，参考 text2metric.py 的实现"""
        try:
            if not input or not input.strip():
                raise Text2DIPMetricError(detail="输入问题不能为空", reason="输入问题不能为空")

            fixed_metric_id = self._validate_specified_metric_id(specified_metric_id)
            self._ensure_metric_ids_configured(
                self.bkn_metric.get_data_list() if self.bkn_metric else [],
                fixed_metric_id,
            )

            # 添加额外信息
            background = self._add_extra_info(extra_info)

            # 异步初始化指标详情和样例
            metric_details, sample_data = await self._ainit_dip_metric_details_and_samples(
                input, specified_metric_id=fixed_metric_id,
            )

            errors = {}
            res = {}
            res_for_llm = {}
            llm_res = {}  # Initialize before retry loop to avoid undefined variable
            call_res = {}

            # 重写指标查询语句，提高指标查询的准确性
            question = input
            if self.rewrite_query:
                question = await self._arewrite_metric_query(input, background, metric_details, sample_data)
                logger.debug(f"重写后的指标查询语句->: {question}")

            for i in range(self.retry_times):
                logger.debug("============" * 10)
                logger.debug(f"{i + 1} times to process DIP metric query (async)......")
                try:
                    llm_res, call_res = {}, {}  # Reset for each retry

                    # 配置 LLM 链
                    chain = self._config_chain(
                        metric_details=metric_details,
                        samples=sample_data,
                        errors=errors,
                        background=background,
                        fixed_metric_id=fixed_metric_id,
                    )

                    # 异步调用 LLM
                    response = await chain.ainvoke({"input": question})
                    logger.debug(f"LLM 响应: {response.content}")

                    # 解析响应
                    llm_res = self._parse_response(response.content)
                    logger.debug(f"解析后的结果: {llm_res}")

                    if fixed_metric_id:
                        llm_res["metric_id"] = fixed_metric_id

                    # 获取指标ID和查询参数
                    metric_id = llm_res.get("metric_id", "")
                    param = llm_res.get("query_params", {})

                    if metric_id == "":
                        if self.api_mode:
                            return {"output": dict(llm_res)}
                        else:
                            return llm_res

                    metric_name = ""
                    for detail in metric_details:
                        if detail.get("id") == metric_id:
                            metric_name = detail.get("name")
                            break

                    # 添加引用信息
                    res["cites"] = [
                        {
                            "id": metric_id,
                            "name": metric_name,
                            "type": "metric"
                        }
                    ]

                    res.update(llm_res)
                    res_for_llm = res.copy()

                    # 执行查询
                    if metric_id and param:
                        call_res = await self._aexecute_query(metric_id, param)
                        logger.info(f"BKN 指标调用结果: {call_res}")

                        if call_res.get("error"):
                            raise Text2DIPMetricError(call_res["error"])

                        # 先拷贝一份给大模型的结果
                        res_for_llm = res.copy()

                        # 处理执行结果
                        execution_result, raw_result = self._process_execution_result(call_res)

                        # 更新给大模型的结果和原始结果
                        res_for_llm.update(execution_result)
                        res.update(raw_result)

                        # 设置标题
                        if res.get("title", "") == "":
                            res["title"] = input

                        if not raw_result.get("data"):
                            res_for_llm.pop("result_cache_key", None)
                            res_for_llm["message"] = "查询结果为空"

                            res.pop("result_cache_key", None)
                            break

                        # 将完整结果写入缓存, 如果数据为空，则不写入缓存
                        if self.session and raw_result.get("data"):
                            try:
                                self.session.add_agent_logs(
                                    self._result_cache_key,
                                    logs=res
                                )
                            except Exception as e:
                                logger.error(f"添加缓存失败: str{e}")

                        # 如果成功获取结果，跳出重试循环
                        break

                except Exception as e:
                    logger.error(f"第 {i + 1} 次异步处理查询失败: {e}")
                    logger.error(f"错误详情: {traceback.format_exc()}")
                    errors[f"error_{i+1}"] = str(e)

                    logger.error(traceback.format_exc())

                    # 如果是最后一次重试，抛出异常
                    if i == self.retry_times - 1:
                        logger.error(f"异步处理查询失败，已重试 {self.retry_times} 次, 错误详情: {errors}")
                        raise Text2DIPMetricError(reason=f"异步处理查询失败，已重试 {self.retry_times} 次", detail=errors)

                    # 继续下一次重试
                    continue

            if self.api_mode:
                return self._build_api_mode_return(res_for_llm, res)
            else:
                return res

        except Text2DIPMetricError:
            raise
        except Exception as e:
            logger.error(f"异步处理查询失败: {e}")
            logger.error(traceback.format_exc())
            raise Text2DIPMetricError(f"异步处理查询失败: {e}")

    def _parse_response(self, response) -> Dict[str, Any]:
        """解析 LLM 响应"""
        try:
            # 尝试解析 JSON
            if isinstance(response, str):
                # 提取 JSON 部分
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start != -1 and json_end != 0:
                    json_str = response[json_start:json_end]
                    result = json.loads(json_str)
                else:
                    # 如果没有找到 JSON，返回默认格式
                    result = {
                        "metric_id": "",
                        "query_params": {},
                        "explanation": response
                    }
            else:
                result = {
                    "metric_id": "",
                    "query_params": {},
                    "explanation": str(response)
                }

            return result

        except Exception as e:
            logger.error(f"解析响应失败: {e}")
            return {
                "metric_id": "",
                "query_params": {},
                "explanation": f"解析响应失败: {e}",
                "raw_response": str(response)
            }

    def _execute_query(self, metric_id: str, query_params: dict):
        """执行指标查询"""
        try:
            if not self.bkn_metric:
                return {"error": "BKN 指标数据源未初始化"}

            # 调用指标查询
            result = self.bkn_metric.call(metric_id, query_params)
            return result

        except Exception as e:
            logger.error(f"执行指标查询失败: {e}")
            return {"error": f"执行指标查询失败: {e}"}

    async def _aexecute_query(self, metric_id: str, query_params: dict):
        """异步执行指标查询"""
        try:
            if not self.bkn_metric:
                return {"error": "BKN 指标数据源未初始化"}

            # 异步调用指标查询
            result = await self.bkn_metric.acall(metric_id, query_params)
            return result

        except Exception as e:
            logger.error(f"异步执行指标查询失败: {e}")
            return {"error": f"异步执行指标查询失败: {e}"}

    def _process_execution_result(self, result):
        """处理执行结果，参考 text2metric.py 的实现"""
        try:
            # 提取关键信息
            raw_result = {
                "step": result.get("step", ""),
                "unit": result.get("unit", ""),
                "unit_type": result.get("unit_type", ""),
                "data_summary": {},
                "result_cache_key": self._result_cache_key,
                # "dim_mapping": result.get("dim_mapping", {}),
                "data": []
            }

            processed = {}

            data = result["data"]
            total_records = len(data)

            # 数据统计信息
            raw_result["data_summary"] = {
                "total_data_points": total_records,
                "force_limit": self.force_limit,
                "step": result.get("step", ""),
                "unit": result.get("unit", ""),
                "unit_type": result.get("unit_type", "")
            }

            processed = raw_result.copy()

            # 处理数据摘要和精简
            if "data" in result and result["data"]:
                # 设置完整的数据
                raw_result["data"] = data

                # 加上 force_limit 限制
                if self.force_limit > 0:
                    data = data[:self.force_limit]
                    total_records = min(self.force_limit, total_records)

                if self.return_record_limit > 0 or self.return_data_limit > 0:
                    limited_data = []
                    data_len = 0
                    for i in range(total_records):
                        limited_data.append(data[i])
                        data_len += len(json.dumps(data[i], ensure_ascii=False))

                        # 超出数据量限制，至少返回一条数据
                        if self.return_data_limit > 0 and data_len >= self.return_data_limit:
                            break

                        # 超出记录数限制
                        if self.return_record_limit > 0 and len(limited_data) >= self.return_record_limit:
                            break

                    processed["data"] = limited_data
                    processed["data_desc"] = {
                        "return_records_num": len(limited_data),
                        "real_records_num": total_records,
                    }
                else:
                    processed["data"] = data
                    processed["data_desc"] = {
                        "return_records_num": total_records,
                        "real_records_num": total_records
                    }

            return processed, raw_result

        except Exception as e:
            logger.error(f"处理执行结果失败: {e}")
            logger.error(traceback.format_exc())
            return {"error": f"处理执行结果失败: {e}"}

    @staticmethod
    def _dedupe_top_level_metric_fields(payload: Dict[str, Any]) -> None:
        """data_summary 已含 step/unit/unit_type 时去掉顶层重复键。"""
        ds = payload.get("data_summary")
        if not isinstance(ds, dict):
            return
        for k in ("step", "unit", "unit_type"):
            if k in ds and payload.get(k) == ds.get(k):
                payload.pop(k, None)

    def _build_api_mode_return(
        self, res_for_llm: Dict[str, Any], res: Dict[str, Any]
    ) -> Dict[str, Any]:
        """api_mode：output 为主结果；full_output 仅在与 output 不一致时附带（通常为完整 data）。"""
        out = dict(res_for_llm)
        self._dedupe_top_level_metric_fields(out)
        full_data = res.get("data")
        out_data = out.get("data")
        ret: Dict[str, Any] = {"output": out}
        if full_data is not None and full_data != out_data:
            ret["full_output"] = {"data": full_data}
        return ret

    @classmethod
    def from_bkn_metric(
        cls,
        bkn_metric: BKNNativeMetricDataSource,
        llm: Optional[Any] = None,
        session_id: Optional[str] = "",
        api_mode: bool = False,
        *args,
        **kwargs
    ):
        """从 BKN 原生指标数据源创建工具实例。"""
        instance = cls(
            bkn_metric=bkn_metric,
            llm=llm,
            session_id=session_id,
            api_mode=api_mode,
            *args, **kwargs)

        return instance

    from_dip_metric = from_bkn_metric

    @staticmethod
    def _params_for_api_log(params: dict) -> dict:
        """深拷贝请求体并脱敏 token / key，供日志打印。"""
        try:
            out = copy.deepcopy(params) if isinstance(params, dict) else {"_non_dict": str(params)}
        except Exception:
            out = {"_repr": repr(params)}
        ds = out.get("data_source") if isinstance(out, dict) else None
        if isinstance(ds, dict) and ds.get("token"):
            tok = str(ds["token"])
            ds["token"] = f"<redacted len={len(tok)}>"
        illm = out.get("inner_llm") if isinstance(out, dict) else None
        if isinstance(illm, dict):
            for k in list(illm.keys()):
                lk = str(k).lower()
                if any(x in lk for x in ("key", "password", "secret", "token")):
                    illm[k] = "<redacted>"
        return out if isinstance(out, dict) else {"_sanitized": out}

    @classmethod
    @api_tool_decorator
    async def as_async_api_cls(
        cls,
        params: dict = Body(...),
        stream: bool = False,
        mode: str = "http"
    ):
        """异步 API 调用"""
        try:
            logger.info(
                "text2metric as_async_api_cls 入参 stream=%s mode=%s body=%s",
                stream,
                mode,
                json.dumps(
                    cls._params_for_api_log(params),
                    ensure_ascii=False,
                    default=str,
                ),
            )
            # Data Source Params (参考 text2sql 的结构)
            data_source = params.get("data_source", {})
            token = data_source.get('token', '')
            # user = data_source.get('user', '')
            # password = data_source.get('password', '')
            user_id = data_source.get('user_id', '')
            account_type = data_source.get('account_type', 'user')
            kn_params = data_source.get('kn', [])

            # 设置指标列表（从 data_source 中获取）
            # 可能格式为：
            # {
            #     "metric_list": ["metric_id1", "metric_id2", "metric_id3"]
            # }
            # 或者
            # {
            #     "metric_list": [
            #         {
            #             "metric_model_id": "metric_id1"
            #         }
            #       ]
            # }
            metric_list = cls._parse_metric_list_from_data_source(
                data_source.get("metric_list", [])
            )

            # kn：仅用于在未填 kn_id 时解析业务知识网络 ID（不再通过 agent-retrieval 按问题检索指标）
            resolved_kn_id = (data_source.get("kn_id") or "").strip()
            specified_metric_id_req = (data_source.get("specified_metric_id") or "").strip()
            cls._ensure_metric_ids_configured(metric_list, specified_metric_id_req)
            last_kn_id = ""
            for kn_param in kn_params or []:
                if isinstance(kn_param, dict):
                    kn_id_item = kn_param.get('knowledge_network_id', '')
                else:
                    kn_id_item = kn_param
                last_kn_id = (kn_id_item or "").strip()

            if not resolved_kn_id:
                resolved_kn_id = last_kn_id

            # 创建 BKN 原生指标数据源（bkn-backend / ontology-query 根地址取自 config / 环境变量，请求体不再覆盖）
            bkn_metric = BKNNativeMetricDataSource(
                kn_id=resolved_kn_id,
                token=token,
                user_id=user_id,
                account_type=account_type,
                metric_list=metric_list,
            )

            llm_headers = {
                "x-user": user_id,
                "x-account-id": user_id,
                "x-account-type": account_type
            }

            # LLM Params
            llm_dict = parse_llm_from_model_factory(params.get("inner_llm", {}), headers=llm_headers)
            llm = CustomChatOpenAI(**llm_dict)

            # 会话存储：仅允许顶层 session_type（默认 redis）；与已移除的 config.session_type 二选一历史兼容由客户端迁移
            _sess = (params.get("session_type") or "redis").strip().lower()
            if _sess not in ("redis", "in_memory"):
                _sess = "redis"

            # 创建工具实例（limit、recall 等使用全局 settings；无 config 大对象）
            tool = cls.from_bkn_metric(
                bkn_metric,
                llm=llm,
                api_mode=True,
                recall_top_k=_SETTINGS.INDICATOR_RECALL_TOP_K,
                dimension_num_limit=_SETTINGS.TEXT2METRIC_DIMENSION_NUM_LIMIT,
                session_type=_sess,
            )

            # Infos Params（指定指标仅认 data_source.specified_metric_id）
            infos = dict(params.get("infos") or {})
            infos.pop("specified_metric_id", None)
            infos['input'] = params.get('input', '')
            infos['action'] = params.get('action', 'query')
            if specified_metric_id_req:
                infos["specified_metric_id"] = specified_metric_id_req

            # 执行查询
            result = await tool.ainvoke(input=infos)
            return result

        except Text2DIPMetricError:
            raise
        except Exception as e:
            logger.error(f"异步 API 调用失败: {e}")
            raise e

    @staticmethod
    async def get_api_schema():
        """获取 API Schema"""
        return {
            "post": {
                "summary": "text2metric",
                "description": "根据文本生成指标查询参数, 并查询指标数据",
                "parameters": [
                    {
                        "name": "stream",
                        "in": "query",
                        "description": "是否流式返回",
                        "schema": {
                            "type": "boolean",
                            "default": False
                        },
                    },
                    {
                        "name": "mode",
                        "in": "query",
                        "description": "请求模式",
                        "schema": {
                            "type": "string",
                            "enum": ["http", "sse"],
                            "default": "http"
                        },
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "data_source": {
                                        "type": "object",
                                        "description": (
                                            "数据源配置信息；bkn-backend / ontology-query 根地址与 BKN 分支由服务端 "
                                            "config（ADP_ONTOLOGY_MANAGER_HOST、ADP_ONTOLOGY_QUERY_HOST 等）决定，请求体不覆盖"
                                        ),
                                        "properties": {
                                            "metric_list": {
                                                "type": "array",
                                                "description": (
                                                    "候选指标 ID 列表，供模型从中选择；可为空，"
                                                    "此时须设置 specified_metric_id 指定唯一指标"
                                                ),
                                                "items": {
                                                    "type": "string"
                                                }
                                            },
                                            "token": {
                                                "type": "string",
                                                "description": "认证令牌"
                                            },
                                            "user_id": {
                                                "type": "string",
                                                "description": "用户ID"
                                            },
                                            "account_type": {
                                                "type": "string",
                                                "description": "调用者的类型，user 代表普通用户，app 代表应用账号，anonymous 代表匿名用户",
                                                "enum": ["user", "app", "anonymous"],
                                                "default": "user"
                                            },
                                            "kn": {
                                                "type": "array",
                                                "description": (
                                                    "知识网络配置；未填 data_source.kn_id 时，取本数组最后一项的 "
                                                    "knowledge_network_id 作为 kn_id（不发起指标检索）"
                                                ),
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "knowledge_network_id": {
                                                            "type": "string",
                                                            "description": "知识网络ID"
                                                        },
                                                        "object_types": {
                                                            "type": "array",
                                                            "description": "知识网络对象类型",
                                                            "items": {
                                                                "type": "string"
                                                            }
                                                        }
                                                    },
                                                    "required": ["knowledge_network_id"]
                                                }
                                            },
                                            "kn_id": {
                                                "type": "string",
                                                "description": (
                                                    "业务知识网络 ID（bkn-backend / ontology-query 路径参数）；"
                                                    "与 kn 数组可同时存在，未填时取 kn 最后一项"
                                                )
                                            },
                                            "specified_metric_id": {
                                                "type": "string",
                                                "description": (
                                                    "用户指定的 BKN 指标 id；设置后跳过指标选择，仅由 LLM 生成 query_params 并执行查询。"
                                                )
                                            }
                                        }
                                    },
                                    "inner_llm": {
                                        "type": "object",
                                        "description": "内部语言模型配置，用于指定内部使用的 LLM 模型参数，如模型ID、名称、温度、最大token数等。支持通过模型工厂配置模型"
                                    },
                                    "infos": {
                                        "type": "object",
                                        "description": "额外的输入信息（可选 extra_info）",
                                        "properties": {
                                            "extra_info": {
                                                "type": "string",
                                                "description": "额外信息（拼入 LLM 背景）"
                                            }
                                        }
                                    },
                                    "input": {
                                        "type": "string",
                                        "description": "用户输入的自然语言查询"
                                    },
                                    "session_type": {
                                        "type": "string",
                                        "description": (
                                            "会话存储：redis（默认）或 in_memory（无 Redis 环境冒烟时使用）"
                                        ),
                                        "enum": ["redis", "in_memory"],
                                        "default": "redis"
                                    },
                                    "action": {
                                        "type": "string",
                                        "description": "操作类型：query 执行指标查询（默认）",
                                        "enum": [
                                            "query"
                                        ],
                                        "default": "query"
                                    },
                                    "timeout": {
                                        "type": "number",
                                        "description": "请求超时时间（秒），超过此时间未完成则返回超时错误，默认120秒",
                                        "default": 120
                                    }
                                },
                                "required": [
                                    "data_source",
                                    "input"
                                ]
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Successful operation",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "title": {
                                            "type": "string",
                                            "description": "查询标题"
                                        },
                                        "data": {
                                            "type": "array",
                                            "description": "查询结果数据",
                                            "items": {
                                                "type": "object"
                                            }
                                        },
                                        "data_desc": {
                                            "type": "object",
                                            "description": "数据描述信息",
                                            "properties": {
                                                "return_records_num": {
                                                    "type": "integer",
                                                    "description": "返回记录数"
                                                },
                                                "real_records_num": {
                                                    "type": "integer",
                                                    "description": "实际记录数"
                                                }
                                            }
                                        },
                                        "metric_id": {
                                            "type": "string",
                                            "description": "选择的指标ID，基于用户输入自动匹配并选择的指标标识符"
                                        },
                                        "query_params": {
                                            "type": "object",
                                            "description": "生成的查询参数，包含时间范围、过滤条件、步长等指标查询所需的参数"
                                        },
                                        "explanation": {
                                            "type": "object",
                                            "description": "查询解释说明，以字典形式展示指标选择、时间范围、过滤条件等信息的业务含义"
                                        },
                                        "cites": {
                                            "type": "array",
                                            "description": "引用的指标列表，包含指标ID、名称、类型等信息",
                                            "items": {
                                                "type": "object"
                                            }
                                        },
                                        "result_cache_key": {
                                            "type": "string",
                                            "description": "结果缓存键，用于从缓存中获取完整查询结果，前端可通过此键获取完整数据"
                                        },
                                        "execution_result": {
                                            "type": "object",
                                            "description": "指标执行结果详情，包含指标元信息、数据摘要、样例数据等"
                                        }
                                    }
                                },
                                "example": {
                                    "output": {
                                        "metric_id": "cpu_usage_metric",
                                        "query_params": {
                                            "instant": False,
                                            "start": 1646360670123,
                                            "end": 1646471470123,
                                            "step": "1m",
                                            "filters": [
                                                {
                                                    "name": "labels.host",
                                                    "value": [
                                                        "server-1",
                                                        "server-2"
                                                    ],
                                                    "operation": "in"
                                                }
                                            ]
                                        },
                                        "explanation": {
                                            "CPU使用率": [
                                                {
                                                    "指标": (
                                                        "使用 'CPU使用率' 指标，按 '时间' '最近1小时' 的数据，"
                                                        "并设置过滤条件 '主机为server-1和server-2'"
                                                    )
                                                },
                                                {
                                                    "时间": "从 2024-01-01 到 2024-01-02"
                                                },
                                                {
                                                    "主机": "包含 server-1, server-2"
                                                }
                                            ]
                                        },
                                        "cites": [
                                            {
                                                "id": "cpu_usage_metric",
                                                "name": "CPU使用率",
                                                "type": "metric",
                                                "description": "CPU使用率指标"
                                            }
                                        ],
                                        "data": [
                                            {
                                                "时间": "2024-01-01 10:00:00",
                                                "主机": "server-1",
                                                "CPU使用率": 75.5
                                            },
                                            {
                                                "时间": "2024-01-01 10:01:00",
                                                "主机": "server-1",
                                                "CPU使用率": 78.2
                                            }
                                        ],
                                        "title": "最近1小时CPU使用率",
                                        "data_desc": {
                                            "return_records_num": 2,
                                            "real_records_num": 120
                                        },
                                        "execution_result": {
                                            "success": True,
                                            "model_info": {
                                                "id": "cpu_usage_metric",
                                                "name": "CPU使用率",
                                                "metric_type": "atomic",
                                                "query_type": "dsl",
                                                "unit": "%"
                                            },
                                            "data_summary": {
                                                "total_data_points": 120,
                                                "step": "1m",
                                                "is_variable": False,
                                                "is_calendar": False
                                            },
                                            "sample_data": [
                                                {
                                                    "index": 1,
                                                    "labels": {
                                                        "host": "server-1"
                                                    },
                                                    "time_points": 120,
                                                    "value_points": 120,
                                                    "sample_times": [
                                                        1646360670123,
                                                        1646360730123
                                                    ],
                                                    "sample_values": [
                                                        75.5,
                                                        78.2
                                                    ]
                                                }
                                            ]
                                        },
                                        "result_cache_key": "cpu_usage_metric_1646360670123_1646471470123"
                                    },
                                    "time": "2.5",
                                    "tokens": "150"
                                }
                            }
                        }
                    }
                }
            }
        }

    @staticmethod
    def get_mock_result():
        res = {
            "cites": [{
                "id": "mock",
                "name": "立白销量",
                "type": "metric"
            }
            ],
            "unit": "件",
            "id": "mock",
            "params": {
                "filters": [{
                    "name": "品牌",
                    "operation": "=",
                    "value": "小白白品牌"
                }
                ],
                "start": 1646360670123,
                "end": 1646471470123,
                "step": "1m",
                "instant": False
            },
            "explanation": {
                "立白销量": [{
                    "指标": "使用 '立白销量' 指标，按 '时间' '2024年1月到2024年12月' 的数据，并设置过滤条件 '品牌为小白白品牌'"
                }, {
                    "时间": "从 2024-01-01 到 2024-12-31"
                }, {
                    "日期(按月)": "全部"
                }, {
                    "品牌": "等于 小白白品牌"
                }
                ]
            },
            "title": "2024年小白白品牌每月销量",
            "data": [{
                "日期(月)": "2024-01",
                "立白销量": 1694.1372677178583
            }, {
                "日期(月)": "2024-02",
                "立白销量": 1667.5650000348517
            }, {
                "日期(月)": "2024-03",
                "立白销量": 1691.206653715858
            }
            ],
            "result_cache_key": "mock_result_key",
            "execution_result": {
                "success": True,
                "model_info": {
                    "id": "mock",
                    "name": "立白销量",
                    "metric_type": "atomic",
                    "query_type": "sql",
                    "unit": "件"
                },
                "data_summary": {
                    "total_data_points": 120,
                    "step": "1m",
                    "is_variable": False,
                    "is_calendar": False
                },
                "sample_data": []
            },
            "time": "18.41778826713562",
            "tokens": "0",
        }

        return {"output": res}


if __name__ == '__main__':
    async def main():
        """测试函数"""
        from app.tools.base import validate_openapi_schema
        is_valid, error_msg = validate_openapi_schema(await Text2MetricTool.get_api_schema())
        logger.info(f"验证结果: {is_valid}, 错误信息: {error_msg}")

        # 创建 Mock DIP Metric
        # from data_retrieval.datasource.dip_metric import MockDIPMetric

        # dip_metric = MockDIPMetric(token="test_token")
        # dip_metric.set_data_list(["metric_1", "metric_2"])

        # # 创建工具实例
        # tool = Text2MetricTool.from_dip_metric(dip_metric)

        # # 测试查询
        # result = await tool._aprocess_query(
        #     "查询最近1小时的CPU使用率",
        #     "",
        #     [],
        #     {}
        # )

        # print("查询结果:", json.dumps(result, ensure_ascii=False, indent=2))

    import asyncio
    asyncio.run(main())
