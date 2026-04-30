from __future__ import annotations
from pathlib import Path

from config import settings

API_BASE_URL = "http://agent-operator-integration:9000/api/agent-operator-integration/internal-v1"

openapi_file_path = Path(__file__).parent / "openai"

_raw_tool_box_configs = [
    {
        "box_id": "c5f6a6a3-6c3f-4b6b-bb1c-7f6d5b8e3a22",
        "box_name": "数据分析员工具",
        "box_desc": "包含数据分析工具，支持意图理解、问数、找数等功能",
        "metadata_type": "openapi",
        "source": "custom",
        "config_version": "1.0.0",
        "config_source": "auto",
        "file_path": openapi_file_path / "data_analyst_tools.openapi.json",
        "content_type": "application/json",
    },
    {
        "box_id": "8a2d1b7e-0d5a-4e63-9b3c-6f4e2a1d9c77",
        "box_name": "数据理解工具箱",
        "box_desc": "数据理解 kweaver",
        "metadata_type": "openapi",
        "source": "custom",
        "config_version": "1.0.0",
        "config_source": "auto",
        "file_path": openapi_file_path / "data_understanding_toolbox.openapi.json",
        "content_type": "application/json",
    },
]


def _filter_existing_openapi_files(configs: list[dict]) -> list[dict]:
    filtered: list[dict] = []
    for cfg in configs:
        file_path: Path = cfg.get("file_path")  # type: ignore[assignment]
        if isinstance(file_path, Path) and file_path.exists():
            filtered.append(cfg)
    return filtered


tool_box_configs = _filter_existing_openapi_files(_raw_tool_box_configs)
