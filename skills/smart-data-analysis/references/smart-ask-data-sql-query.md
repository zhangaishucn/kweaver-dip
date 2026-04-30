# 第9步：复杂查询数据（smart-ask-data）

本文件定义 `smart-ask-data` 第 9 步在“复杂查询”场景下的执行规范。

分支边界声明：本文件仅适用于第 9 步复杂查询分支，不得跨分支改用简单筛选命令替代执行。

## 适用场景

当第 9 步完成分流判断后，若问题不满足“简单条件筛选问题”判定，必须执行本文件流程。

## 执行目标

根据第 8 步获取的候选表详情，生成可执行 SQL，并通过 `kweaver dataview query` 返回可复核结果。

## 执行要求（必须）

1. 根据候选表详情中的 `meta_table_name`、`fields` 字段名称以及用户问题，构造可执行 SQL。  
2. SQL 中仅使用已确认字段，并补齐必要的时间范围、过滤条件与聚合口径。  
3. 生成 SQL 后，使用 `kweaver dataview query <dataview_id> --sql <sql_var> --limit <n>` 执行查询并返回结果。  
4. **SQL 展示边界（必须）**：生成的 SQL 仅用于内部执行，最终对用户回复中**不得展示 SQL 原文、SQL 片段、`SELECT/FROM/WHERE` 语句或可还原 SQL 的模板**；仅允许输出查询结果与最小口径说明。  

## 复杂查询细则

- **日期及区间合法性（本步内必须完成）**：在落笔最终可执行 SQL 文本前，对将写入 `WHERE` / `HAVING` 等子句中的公历日期字面量与按日期表达的区间（如 `BETWEEN ... AND ...`、成对的 `>=` 与 `<`、单月单日的等值等）做日历合法性校核。若任一为无效公历日、无效月份/日期组合，或区间在日历意义上不成立（如右端点早于左端点且非刻意排除型写法），须先向用户说明哪一处不合法、为何不能执行，并请用户修正后再从本步重试。若本 SQL 不涉及公历日期条件，可记为「本步无日期条件待校」并继续执行查询（仍须满足其余命令与权限约束）。总入口在「问数」下已做日期校核的，本步仍须针对第 9 步字段与最终 SQL 文本再核一次，防止自然语言到 SQL 的偏差、字段类型误解或方言字面量导致非法日期进查询。
- **表名生成约束**：`FROM` / `JOIN` 中使用的表名必须取自 `meta_table_name`；同时参考 `sql_str` 的库名、schema 与引号风格，保持与数据视图定义一致，禁止手写或猜测表名。
- **口径规则优先级**：生成 SQL 时必须优先对齐 [`smart-ask-data-knowledge.md`](smart-ask-data-knowledge.md) 中的默认口径与场景规则（如企业名称非空、企业口径默认不含个体工商户等）；若与用户明确口径冲突，以用户明确口径为准并在结果中说明。
- **默认行数上限**：除非用户明确要求其他条数或「全量/不限」（须在口径中注明），生成的可执行 `SELECT` 必须在可合法添加 `LIMIT` 的最外层结果集上默认附加 `LIMIT 200`，将返回行数限制为至多 200 条；若语句为嵌套子查询 / `WITH`，将 `LIMIT 200` 加在最终向外输出明细或聚合结果的那一层 `SELECT` 之后、`ORDER BY`（如有）之后。仅返回单行标量聚合时（如仅 `SELECT COUNT(*)`、`SELECT SUM(...)`）无需也不应再加 `LIMIT 200`。
- **Top 百分比**（前10%/前20%/前百分之几等）的 `NTILE` 写法、`LIMIT (SELECT ...)` 禁用及口径说明，见 [`smart-ask-data-knowledge.md`](smart-ask-data-knowledge.md) 章节「场景补充：前百分之几（Top X%）查询」。
- **执行与默认条数**：执行查询时使用 `kweaver dataview query <dataview_id> --sql <sql_var> --limit <n>`；默认取 `<n>` = `200`，与 SQL 内 `LIMIT 200` 对齐（若 SQL 已含 `LIMIT 200`，`--limit` 仍建议为 `200`）；若用户口径或平台能力与 200 条默认不一致，须在最小口径中说明。
- **用户可见输出约束**：无论成功或失败，用户可见回复中均不得回显 SQL 文本；失败场景仅返回错误原因与修正建议，不附 SQL 原文。
- **命令限定（必须）**：复杂查询分支仅允许 `kweaver dataview query` 及下列传参方式；若执行失败，按强约束停止流程，不得使用任何本文件未列出的命令、接口或工具替代执行查询。

### PowerShell 传参示例（推荐）

```powershell
$sql = @'
SELECT * FROM mysql_7wpnfjvg."adp_gzfrk"."scjg_e_pb_baseinfo"
LIMIT 200
'@
kweaver dataview query 30e7b062-7013-4449-aa6f-9314ece7346c --sql $sql --limit 200
```

### Linux（bash/zsh）传参示例（推荐）

```bash
sql=$(cat <<'SQL'
SELECT * FROM mysql_7wpnfjvg."adp_gzfrk"."scjg_e_pb_baseinfo"
LIMIT 200
SQL
)
kweaver dataview query 30e7b062-7013-4449-aa6f-9314ece7346c --sql "$sql" --limit 200
```

### 单行命令补充

仅当必须单行命令时，才使用 `--sql '<sql>'`，并处理内部引号转义。
