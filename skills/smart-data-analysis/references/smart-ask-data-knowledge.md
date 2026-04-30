# smart-ask-data 经验沉淀

> 展示约束（与 `smart-ask-data.md` 保持一致）：本文件中的 SQL 仅用于内部生成与校验，不对用户展示 SQL 原文；对用户仅展示查询结果与口径说明。

## 企业与个体工商户（默认口径）

当用户只说「企业」「公司」「法人」等，**没有**特别声明要包含「个体工商户」时，**默认不把个体工商户当作企业**：

- **主体分类定义**：个体工商户不属于企业，而是一种特殊的经济组织形式，与企业并列为独立的市场主体类别。
- **表选择**：`scjg_e_pb_baseinfo`（个体工商户信息）专表对应个体工商户；问「企业」类问题时**不要默认**从该表取数，除非用户点名要查个体工商户。
- **字段过滤**：在 `scjg_e_baseinfo`（企业基本信息）中，若 `enttype_cn`（或等价类型字段）表示「个体工商户」，应在 SQL 中**排除**。

可复用规则（默认启用，除非用户明确要求包含个体工商户）：

- 在 `scjg_e_baseinfo` 上增加类型排除，例如：
  - `AND enttype_cn NOT LIKE '%个体工商户%'`
  - 若已知精确码值，优先用 `enttype` / `enttype_cn` 与白名单或 `NOT IN (...)` 排除（以实际枚举为准）。
- 在最终结果说明中若应用了该规则，用一句话说明：**未特别声明时，企业口径不含个体工商户**。

## 场景补充：法定代表人姓名（防遗漏口径）

当用户仅提“查询法定代表人的姓名”，但未限定主体范围时，不能默认只查通用企业表；需要先覆盖多主体候选，再按用户口径收敛。

可复用规则（默认启用）：

- 候选表至少同时检查以下对象（若在当前 KN 中存在）：
  - `scjg_e_baseinfo`（企业基本信息，字段常见为 `name`）
  - `sft_gzfw_lsls_jalaw_lawfirm`（律所信息表，字段常见为 `director_name`）
- 若两者均命中“法定代表人姓名”语义，先向用户澄清是“企业主体”“律所主体”还是“全部主体”。
- 若用户选择“全部主体”，建议并行查询并在结果中增加来源字段（如 `数据来源`）区分口径。
- 在最终回复中必须保留未采用候选的说明，避免“静默丢弃候选表”。

示例澄清话术：

- “当前‘法定代表人姓名’可落在企业基本信息和律所信息表两类主体，请确认要查询：企业、律所，还是全部主体？”

## 场景

在查询“企业投资者的认缴出资额”时，常见需求是同时展示企业名称、投资者、认缴出资额。

## 问题现象

- 仅查询 `scjg_e_inv_investment`（企业投资者信息）可拿到 `inv`、`subconam`，但企业名称可能缺失。
- 与 `scjg_e_baseinfo` 联表后，若不加约束，结果中可能出现 `企业名称 = null` 的记录。

## 经验结论

企业投资者类查询（如投资者、认缴/实缴出资、投资比例）默认需要保证企业主体信息有效。

当业务要求“企业名称不能为 null”时，必须在 SQL 中显式增加：

- `b.entname IS NOT NULL`

并建议使用 `JOIN`（内连接）替代 `LEFT JOIN`，从结构上避免保留无企业主体匹配的数据。

可复用规则（默认启用）：

- 企业投资者类查询默认增加企业信息非空约束：`b.entname IS NOT NULL`。
- 如还需更严格口径，可补充：`b.pripid IS NOT NULL` 与企业地址/状态等业务过滤条件。

## 推荐查询模板

```sql
SELECT
  b.entname AS 企业名称,
  i.inv AS 投资者,
  i.subconam AS 认缴出资额_万元
FROM mysql_7wpnfjvg.""adp_gzfrk"".""scjg_e_inv_investment"" i
JOIN mysql_7wpnfjvg.""adp_gzfrk"".""scjg_e_baseinfo"" b
  ON i.pripid = b.pripid
WHERE i.subconam IS NOT NULL
  AND b.entname IS NOT NULL
ORDER BY i.subconam DESC, b.entname ASC, i.inv ASC
```

> 说明：若在 shell 单行中传 SQL 需要额外转义；在 SQL 本体中推荐使用标准双引号：
> `mysql_7wpnfjvg."adp_gzfrk"."scjg_e_inv_investment"`、`mysql_7wpnfjvg."adp_gzfrk"."scjg_e_baseinfo"`。

## 执行口径建议

- 首先统计条数，确认过滤后剩余记录规模（`COUNT(*)`，并带同样的 `WHERE` 条件）。
- 再拉取明细，避免先看明细再发现口径不一致。
- 在回复中明确说明企业名称已过滤 `IS NOT NULL`。
- 在回复中明确说明认缴出资额字段单位为“万元”。

## 场景补充：前百分之几（Top X%）查询

当用户问题包含“前10%/前20%/前百分之几”等 **Top 百分比**诉求时，**生成 SQL 须默认优先**采用 **`NTILE` 窗口函数分桶**写法（例如 **`NTILE(100) ... WHERE bucket <= X`**，`X` 为用户要取的前百分之几所对应的桶上界）；**避免**使用 **`LIMIT (SELECT ...)`** 这类动态限制语法，以降低 SQL 方言兼容性风险。

**Top 百分比 SQL 在结果口径中须写清：** 排序指标 **`IS NOT NULL`**，目标展示字段建议 **`IS NOT NULL`**；并说明“前 X%”为 **按记录数分桶**（`NTILE` 语义），**不是**业务金额/指标累计占比，除非用户另行定义并经 SQL 体现。

可复用规则（默认启用）：

- 优先使用 `NTILE(100)` 做百分位分桶，再按 `bucket <= X` 过滤（`X` 为用户指定百分比）。
- 排序字段必须显式 `IS NOT NULL`，目标展示字段建议同时加 `IS NOT NULL`。
- `ORDER BY` 必须与业务“前高后低”一致（通常 `DESC`）。
- 在回复中明确“前 X%”口径是按记录数分桶得到，而非业务金额占比。

推荐模板（Top X%，X 取 1-100）：

```sql
SELECT target_col, metric_col
FROM (
    SELECT
        {target_col} AS target_col,
        {metric_col} AS metric_col,
        NTILE(100) OVER (ORDER BY {metric_col} DESC) AS bucket
    FROM {table_name}
    WHERE {metric_col} IS NOT NULL
      AND {target_col} IS NOT NULL
      {and_condition}
) t
WHERE t.bucket <= {top_percent}
ORDER BY t.metric_col DESC, t.target_col ASC
```

示例（注册资本金前10%的企业名称）：

```sql
SELECT target_col
FROM (
    SELECT
        b.entname AS target_col,
        b.regcap AS metric_col,
        NTILE(10) OVER (ORDER BY b.regcap DESC) AS bucket
    FROM mysql_7wpnfjvg."adp_gzfrk"."scjg_e_baseinfo" b
    WHERE b.regcap IS NOT NULL
      AND b.entname IS NOT NULL
) t
WHERE t.bucket = 1
ORDER BY t.metric_col DESC
```

