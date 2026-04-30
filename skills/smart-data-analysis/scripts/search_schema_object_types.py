#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_schema — ``search_scope`` 仅开启 object_types（响应中的 ``object_types``）。

依赖 stdlib；实现见同目录 ``search_schema_common.py``。
说明：[`references/search-schema-scripts.md`](../references/search-schema-scripts.md)
"""

from __future__ import annotations

from search_schema_common import OBJECT_TYPES_SCOPE, main_fixed_scope

if __name__ == "__main__":
    raise SystemExit(
        main_fixed_scope(
            OBJECT_TYPES_SCOPE,
            prog="search_schema_object_types.py",
            description="search_schema API — include_object_types only (object_types)",
        )
    )
