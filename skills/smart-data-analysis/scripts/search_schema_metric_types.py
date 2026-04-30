#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_schema — ``search_scope`` 仅开启 metric_types（响应中的 ``metric_types``）。

依赖 stdlib；实现见同目录 ``search_schema_common.py``。
说明：[`references/search-schema-scripts.md`](../references/search-schema-scripts.md)
"""

from __future__ import annotations

from search_schema_common import METRIC_TYPES_SCOPE, main_fixed_scope

if __name__ == "__main__":
    raise SystemExit(
        main_fixed_scope(
            METRIC_TYPES_SCOPE,
            prog="search_schema_metric_types.py",
            description="search_schema API — include_metric_types only (metric_types)",
        )
    )
