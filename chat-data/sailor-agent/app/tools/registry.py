# -*- coding: utf-8 -*-
"""
Central tool registry for data-retrieval.

Why:
- FastAPI tool server and MCP server should share the same tool mapping.
- Avoid duplicating tool lists in multiple entrypoints.
"""

from __future__ import annotations

from typing import Dict, Type

# Base tools
from app.tools.query_mind.json2plot import Json2PlotTool
from app.tools.query_mind.text2sql import Text2SQLTool
from app.tools.query_mind.text2metric import Text2MetricTool
from app.tools.forecasting.smart_forecasting import ForecastingTool
from data_retrieval.tools.base_tools.sql_helper import SQLHelperTool
from data_retrieval.tools.base_tools.knowledge_item import KnowledgeItemTool
from data_retrieval.tools.base_tools.get_metadata import GetMetadataTool

# NOTE: keep keys stable; they are part of API contracts (FastAPI, future MCP).
BASE_TOOLS_MAPPING: Dict[str, Type] = {
    "text2sql": Text2SQLTool,
    "text2metric": Text2MetricTool,
    "sql_helper": SQLHelperTool,
    "knowledge_item": KnowledgeItemTool,
    "get_metadata": GetMetadataTool,
    "json2plot": Json2PlotTool,
    "smart_forecasting": ForecastingTool,
}
