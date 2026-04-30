# Schema Search 脚本（`search_schema`）

本 skill 在 [`scripts/`](../scripts/) 下提供调用 **`POST …/api/agent-retrieval/in/v1/kn/search_schema`** 的 Python 脚本（标准库 `urllib`，无第三方依赖）。契约与 OpenAPI `search_schema` 一致：仅探索 schema（`object_types` / `relation_types` / `action_types` / `metric_types`），不返回实例数据。

## 文件一览

| 文件 | 作用 |
| --- | --- |
| [`scripts/search_schema_common.py`](../scripts/search_schema_common.py) | 公共：组 JSON Body、请求头、`urllib` 请求；`OBJECT_TYPES_SCOPE` 等四类固定 `search_scope` |
| [`scripts/search_schema_object_types.py`](../scripts/search_schema_object_types.py) | **仅** `include_object_types=true`，其余三类为 `false` |
| [`scripts/search_schema_metric_types.py`](../scripts/search_schema_metric_types.py) | **仅** `include_metric_types=true`，其余三类为 `false` |

仓库根目录 [`tests/search_schema_*.py`](../../../tests/) 中的同名/相关脚本会通过 `sys.path` 引用上述 **`smart-data-analysis/scripts`**，避免重复实现。

## 运行方式

在 **仓库根目录**（`data_analyst_v3`）执行，以便路径解析一致：

```bash
python skills/smart-data-analysis/scripts/search_schema_object_types.py -q "企业" --kn-id <kn_id> --account-type user
python skills/smart-data-analysis/scripts/search_schema_metric_types.py -q "指标" --kn-id <kn_id> --account-type user
```

### 环境变量（常用）

| 变量 | 含义 |
| --- | --- |
| `SEARCH_SCHEMA_BASE_URL` | API 根地址，默认见 `search_schema_common.DEFAULT_BASE_URL` |
| `KN_ID` | 可替代 `--kn-id`（body `kn_id`） |
| `X_ACCOUNT_ID` | 请求头 `x-account-id`（与 `kweaver auth whoami` 的 User ID 一致） |
| `X_ACCOUNT_TYPE` | `user` / `app` / `anonymous`；多数环境需与 `X_ACCOUNT_ID` 同时提供，否则可能 `403` |
| `X_KN_ID` | 可替代 header `x-kn-id`（与 body 兜底二选一逻辑以服务端为准） |

### 命令行参数

与 `search_schema_common.add_common_arguments(..., include_scope_negation_flags=False)` 一致：`-q` / `--query` 必填；`--base-url`、`--kn-id`、`--account-id`、`--account-type`、`--response-format`、`--max-concepts`、`--schema-brief`、`--no-rerank`、`--timeout`、`-o` / `--output` 等。`--help` 查看完整列表。

## 与编排的关系

- **问数前置**：需要收敛「对象类 / 指标类」等 schema 时，可用 `search_schema_object_types.py` 或 `search_schema_metric_types.py` 缩小 `search_scope`，再进入 `smart-ask-data` 的 `search-schema` 等步骤。
- **不替代问数**：脚本只调 HTTP `search_schema`，不产出 SQL；取数仍走 `smart-ask-data`。

## 失败排查

- **`403` / missing account ID or type**：同时设置 `X_ACCOUNT_ID` 与 `--account-type user`（或 `X_ACCOUNT_TYPE`）。
- **连接失败**：检查 `SEARCH_SCHEMA_BASE_URL` 与集群 ingress（含端口）是否与 agent-retrieval 一致。
