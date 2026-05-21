from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

from app.logs.logger import logger
from app.memory.models import MemoryDocumentDTO
from app.memory.service import MemoryService
from app.memory.tools import (
    MemorySearchToolInput,
    MemoryTools,
    MemoryWriteToolInput,
    coerce_memory_user_id,
)
from app.routers.agent_temp_router import MemoryRouter


MemoryAPIRouter = APIRouter()


def _memory_document_to_dict(doc: MemoryDocumentDTO) -> Dict[str, Any]:
    return {
        "id": doc.id,
        "user_id": doc.user_id,
        "source_type": doc.source_type,
        "text": doc.text,
        "title": doc.title,
        "location": doc.location,
        "metadata": doc.metadata or {},
        "datasource_id": doc.datasource_id,
        "segmented_text": doc.segmented_text,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


@MemoryAPIRouter.get(
    f"{MemoryRouter}/document/{{document_id}}",
    summary="按文档 ID 查询记忆（t_memory_documents）",
)
async def memory_get_document_by_id(document_id: str) -> Dict[str, Any]:
    doc_id = (document_id or "").strip()
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required")
    service = MemoryService()
    doc = service.get_document_by_id(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    return _memory_document_to_dict(doc)


@MemoryAPIRouter.put(
    f"{MemoryRouter}/document/{{document_id}}",
    summary="按文档 ID 写入/更新记忆（仅 t_memory_documents）",
)
async def memory_put_document_by_id(
    document_id: str, params: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    请求体字段（对应 t_memory_documents 已有列，不修改表结构）:
    - user_id: 必填
    - text: 必填
    - source_type: 可选，默认 business_rule，取值 business_rule | profile
    - title, location, datasource_id, metadata: 可选

    仅更新文档表；不写入 t_memory_chunks（与批量 write 接口的向量写入路径不同）。
    """
    doc_id = (document_id or "").strip()
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id is required")

    user_id = coerce_memory_user_id(params.get("user_id"))
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    text = str(params.get("text") or "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    st = params.get("source_type", "business_rule")
    if st not in ("business_rule", "profile"):
        raise HTTPException(
            status_code=400,
            detail="source_type must be business_rule or profile",
        )

    raw_ds = params.get("datasource_id")
    datasource_id = (
        str(raw_ds).strip() if raw_ds is not None and str(raw_ds).strip() else None
    )

    doc = MemoryDocumentDTO(
        id=doc_id,
        user_id=user_id,
        source_type=st,
        text=text,
        title=params.get("title"),
        location=params.get("location"),
        metadata=params.get("metadata") if isinstance(params.get("metadata"), dict) else {},
        datasource_id=datasource_id,
    )

    service = MemoryService()
    try:
        service.upsert_documents([doc])
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[memory_put_document_by_id] 写入失败: {exc}")
        raise HTTPException(status_code=500, detail="failed to persist document") from exc

    saved = service.get_document_by_id(doc_id)
    if saved is None:
        raise HTTPException(status_code=500, detail="document not found after write")
    return _memory_document_to_dict(saved)


@MemoryAPIRouter.post(f"{MemoryRouter}/search", summary="记忆搜索接口")
async def memory_search_api(params: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    记忆搜索接口，供 HTTP 直接调用。

    请求体示例:
    {
      "user_id": "10001",
      "query": "用户喜欢喝什么咖啡？",
      "top_k": 5,
      "datasource_ids": ["user_profile"],
      "filters": {...}
    }
    """
    try:
        raw_ds = params.get("datasource_ids")
        if isinstance(raw_ds, str):
            datasource_ids = [raw_ds]
        else:
            datasource_ids = list(raw_ds or [])

        payload = MemorySearchToolInput(
            user_id=coerce_memory_user_id(params.get("user_id")),
            query=str(params.get("query", "") or ""),
            top_k=params.get("top_k"),
            datasource_ids=datasource_ids or None,
            filters=params.get("filters"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[memory_search_api] 参数解析失败: {exc}")
        return {"memories": []}

    tools = MemoryTools()
    result = tools.search(payload)
    return {
        "memories": [
            {
                "id": m.id,
                "document_id": m.document_id,
                "text": m.text,
                "score": m.score,
                "title": m.title,
                "location": m.location,
                "metadata": m.metadata,
                "datasource_id": m.datasource_id,
            }
            for m in result.memories
        ]
    }


@MemoryAPIRouter.post(f"{MemoryRouter}/write", summary="记忆写入接口")
async def memory_write_api(params: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    记忆写入接口，供 HTTP 直接调用。

    请求体示例:
    {
      "user_id": "10001",
      "documents": [
        {
          "id": "coffee_pref_001",
          "text": "用户喜欢喝无糖拿铁，一周大约点 3 次。",
          "title": "咖啡偏好",
          "location": "app://order/coffee",
          "source_type": "profile",
          "datasource_id": "user_profile",
          "metadata": {...}
        }
      ]
    }

    删除某条记忆：在 documents 中传入该条 id，并将 text 或 title 设为字符串 "null"（与 memory_write 工具一致）。
    """
    def _is_null_string(value: Any) -> bool:
        # 只有当传入值本身是字符串 "null" 时才触发删除（与 MemoryWriteTool 一致）
        return isinstance(value, str) and value.strip() == "null"

    try:
        raw_documents = list(params.get("documents") or [])

        delete_ids: list[str] = []
        remaining_documents: list[dict[str, Any]] = []

        for item in raw_documents:
            if not isinstance(item, dict):
                continue

            if _is_null_string(item.get("text")) or _is_null_string(
                item.get("title")
            ):
                raw_id = str(item.get("id") or "").strip()
                if raw_id:
                    delete_ids.append(raw_id)
                else:
                    logger.warning(
                        "[memory_write_api] 删除请求但缺少 id: text=%r title=%r",
                        item.get("text"),
                        item.get("title"),
                    )
                continue

            remaining_documents.append(item)

        user_id = coerce_memory_user_id(params.get("user_id"))
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[memory_write_api] 参数解析失败: {exc}")
        return {"written_ids": []}

    tools = MemoryTools()

    # 先物理删除，再写入其余条目（与 MemoryWriteTool 一致）
    if delete_ids:
        tools.delete_documents(list(set(delete_ids)))

    written_ids: list[str] = []
    if remaining_documents:
        payload = MemoryWriteToolInput(
            user_id=user_id,
            documents=remaining_documents,
        )
        result = tools.write(payload)
        written_ids = result.written_ids

    return {"written_ids": written_ids}

