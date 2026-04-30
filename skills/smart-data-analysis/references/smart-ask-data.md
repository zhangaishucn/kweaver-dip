# smart-ask-data（问数子技能）

用于把自然语言问题按第 9 步分流为可执行查询，并返回可复核的取数结果。

## 参考经验

- [`smart-ask-data-knowledge.md`](smart-ask-data-knowledge.md)：沉淀常见问数口径与 SQL 约束经验（如企业名称非空过滤；**未特别声明时企业口径不含个体工商户**）。
- [`smart-json2plot.md`](smart-json2plot.md)：当用户有画图需求时，将结构化数据转换为绘图数据。

## 使用场景

- 用户要查“多少、明细、汇总、TopN、占比”等可查询问题（第 9 步按类型分流）
- 已明确或可收敛到 `kn_id_ask_data`
- 需要最终交付数据结果，而不是仅定位资产
- 用户在问数后要求画图（柱状图、饼图、折线图、散点图）

## 输入要求

- `kn_id_ask_data`（明细查询知识网络，必须来自 `SOUL.md`）
- `kn_id_metric`（指标聚合知识网络，来自 `SOUL.md`；仅在指标聚合/同环比查询时必填）
- 时间范围、过滤条件、统计口径（至少可推导）
- 认证上下文：`token`、`base_url`、`user_id`（可由上层编排注入）
- 可选：`chart_type`（`bar` / `pie` / `line` / `scatter`）

## 强约束（SOUL 对齐，必须执行）

- 必须严格按第 5-11 步顺序执行，不得跳步、并步、倒序或绕过门禁。
- 禁止编造或篡改流程：不得虚构已执行步骤、不得伪造步骤结果、不得擅自修改流程定义与执行记录。
- 任一步骤失败必须立即停止流程并返回真实失败原因；在失败状态下不得继续后续步骤。
- **关键链门禁**：第 **6**（寻找候选表）、**7**（校验数据查询权限）、**8**（获取候选表详情）、**9**（查询数据，含**日期及区间合法性**校核与执行查询）步任一执行失败（无可用候选、权限校验不通过、详情拉取失败、**公历日期/区间不合法**、简单明细 JSON 条件不合法、简单聚合指标执行失败、复杂查询 SQL 不合法或执行失败等），必须**立即终止全流程**，不得进入第 10 步及以后；**不得**为“跑通结果”而改用本文件未规定的命令或旁路工具继续取数。
- **第 6–9 步命令与路径限定（必须）**：第 **6–9** 步**不得使用本文件未规定的命令或旁路工具**替代规定动作。具体为：第 **6** 步**仅允许**使用 `kweaver context-loader search-schema <知识网络id> "用户问题关键词" --scope object --max 5` 检索候选表/视图；第 **7** 步权限校验**仅允许**使用 `kweaver curl` / `kweaver call` 向本文规定的 **`GET /api/mdl-data-model/v1/data-views/<dataview_id>`** 拉取视图信息并解析 `operations`（**不得**以其它未声明接口替代本步权限判据，但 `dataview get` 不得替代本步对 `data_query` 的显式校验）；若第 7 步判定缺少 `data_query`，必须立即停止流程并提示用户申请对应视图权限；第 **8** 步**仅允许**使用 `kweaver dataview get <dataview_id>` 拉取详情；第 **9** 步按分流执行：简单条件明细查询仅允许使用 `kweaver context-loader query-object-instance <问数知识网络id> <查询语句>`，简单条件聚合查询仅允许按 [`smart-ask-data-structured-and-metric-query.md`](smart-ask-data-structured-and-metric-query.md) 调用指标流程，复杂查询仅允许使用 `kweaver dataview query <dataview_id> --sql <sql_var> --limit <n>`（及对应变量/heredoc 传参方式）。若第 **9** 步失败，**必须**停止并返回真实失败原因，**不得**改用其他 `kweaver` 子命令、数据库直连、自写脚本、其它 HTTP/接口或其它工具替代本步规定动作。**禁止**用其他 `kweaver` 子命令、数据库直连、自写脚本等替代上述第 6–9 步的规定命令与数据依据。
- 最终结果必须包含候选表信息（至少展示候选表名称、候选表 id、入选理由）。
- 最终结果中禁止展示 SQL 原文（SQL 仅用于内部生成与执行）；最终对用户仅展示查询结果与口径说明。
- 防遗漏约束：当同一核心指标字段在多个业务对象中同时命中（例如“法定代表人姓名”同时命中企业与律所），不得仅保留单一候选；至少保留 2 个候选并给出入选理由。
- 歧义澄清约束：若用户问题未限定主体范围且候选涉及多个主体域（如企业、律所、个体），在确定第 9 步查询参数前必须先澄清口径；未澄清时不得默认丢弃高匹配候选。
- **行数默认上限**：明细/多行结果默认上限为 **200**（`dsl_query` 通过 `query-object-instance` 的 `limit` 控制，`complex_query` 通过 SQL `LIMIT` 控制）；单行聚合类结果除外；若用户要求其他条数或全量，以用户口径为准并在交付中说明。

## 📋 任务进度清单（阶段：问数）

- [ ] 待完成 · 步骤一（检查知识网络，第 5 步）
- [ ] 待完成 · 步骤二（寻找候选表并输出候选列表，第 6 步）
- [ ] 待完成 · 步骤三（校验候选表数据查询权限，第 7 步）
- [ ] 待完成 · 步骤四（获取候选表详情，第 8 步）
- [ ] 待完成 · 步骤五（查询类型判定与查询执行，第 9 步）
- [ ] 待完成 · 步骤六（画图需求分支，第 10 步，按需触发）
- [ ] 待完成 · 步骤七（总结结果，第 11 步）
- [ ] 待完成 · 步骤八（输出流程完成态）

## 编排门禁流程（承接总入口第 4 步后继续，序号连续）

进度执行硬约束（必须执行）：
- 每完成第 5-11 步中的任一步，都要立即输出一次进度。
- 进度模板固定为新样式：
  - `## 📋 任务进度清单（阶段：问数）`
  - `- [ ] 已完成 · 步骤N（步骤名称）`
  - `- [ ] 待完成 · 步骤N+1（步骤名称）`
- **第 6 步附加要求**：除上述进度行外，本步**必须同时输出「候选表列表」**（见下文第 6 步「候选表列表」）；**不得**只输出进度而无候选表列表就进入第 7 步。
- 若当前步骤尚未输出进度，**不得进入下一步**。
- 若发现缺步、跳步或步骤失败，必须**立即停止流程**并说明原因，不得继续执行。
- 若流程在第 11 步结束，必须在清单中体现“步骤 11（总结结果）已完成”且其余后续项为空，并标注流程完成。

5. **检查知识网络**：按用途校验知识网络并用于后续分流执行。  
   - 明细查询网络：用于条件查询（`dsl_query` / `simple_detail`），执行 `kweaver bkn get <kn_id_ask_data>` 校验可用性（必校验）。  
   - 指标聚合网络：用于聚合、趋势、同环比（`metric_aggregation` / `simple_aggregation`）。若本次问数命中指标分支，执行 `kweaver bkn get <kn_id_metric>` 校验可用性；若本次仅走明细/复杂查询分支，可缺失且不阻塞流程。  
   - 命中分支所需的网络必须校验通过后，方可进入第 6 步；任一必需网络不存在或不可访问，必须立即停止并返回真实失败原因。
6. **寻找候选表**：使用 `kweaver context-loader search-schema <知识网络id> "用户问题关键词" --scope object --max 5` 检索候选表/视图，优先选择与统计口径、时间范围、核心指标字段匹配的对象进入后续问数流程；筛选时必须同时考虑**视图名称、视图描述、视图字段**三类信息，避免仅凭单一关键词命中。  
   - **候选表列表（第 6 步必须输出）**：在输出「已完成第 6 步」类进度**的同时**，须列出**拟进入第 7 步做权限校验**的候选（一条候选一行，可用 Markdown 表格或等价结构化列表）。每条至少包含：**对象类型/业务名称**（以检索结果 `concept_name`、`name` 等为准）、**数据视图 id**（即后续 `kweaver curl` 拉取、以及 `dataview get` / `dataview query` 所用的 **UUID**，通常对应检索结果中 `data_source` 下 `type` 为 `data_view` 的 `id` 字段，**以接口返回为准，禁止手填**）。若同屏保留多个候选，应完整列出，并与上文「多候选保留」要求一致；无可用候选时，列表可为空，但必须说明无命中并终止流程。
   - 筛选权重要求：提高“视图字段命中”的权重，字段命中优先级应高于仅名称命中或仅描述命中；当名称/描述与字段命中冲突时，以字段匹配结果优先。
   - 建议权重示例：视图字段命中 0.5、视图名称命中 0.3、视图描述命中 0.2（可按业务场景微调，但需保持“字段命中最高”原则）。
  - 多候选保留要求：当出现“字段强匹配 + 对象域不同”的候选（例如 `name`/`director_name` 都映射“法定代表人姓名”）时，默认保留前 2-3 个候选进入**第 7 步**（含权限校验），不得在第 6 步提前裁剪为单表。
   - 关键词扩展要求：对“法定代表人”类问题，检索关键词应至少包含 `法定代表人`、`负责人`、`法人代表`，避免因字段命名差异（如 `name`、`director_name`）漏召回。
  - **第 6 步 `search-schema` 报 `view_detail` 权限不足（失败即停）**：若命令返回体（含嵌套的 `details` / JSON 串）中 **`error_details`** 出现 **`Access denied: insufficient permissions for [view_detail]`**（或与平台一致的等价表述，均指向缺少**视图详情**权限），则**立即终止**问数流程，**不得**进入第 7 步及以后。须向用户**明确提示**：请在平台为当前问数所需的数据视图或业务知识网络完成授权，**配置并开通 `view_detail`（视图详情）权限**（可结合平台「数据视图 / 授权 / 查看详情 / view_detail」等实际菜单名表述）。此情形下**无可用候选**，「候选表列表」可为空，但须在说明中写明上述权限要求与真实报错原文要点。
  - **第 6 步 `search-schema` 报向量模型未启用（失败即停）**：若命令返回体（含嵌套的 `details` / JSON 串）中 **`error_details`** 出现 **`DefaultSmallModelEnabled is false`**（或与平台一致、均指向**概念/向量检索依赖的小模型未启用**的等价表述），则**立即终止**问数流程，**不得**进入第 7 步及以后。须向用户**明确提示**：请在 **`bkn-backend` 服务**侧**配置并启用向量模型**（使 `DefaultSmallModelEnabled` 为可用状态；具体配置项以部署文档为准），否则 `search-schema` 无法完成向量化，第 6 步无有效候选。此情形下**无可用候选**，「候选表列表」可为空，但须在说明中写明上述要求与真实报错原文要点。
7. **校验候选表数据查询权限**：对第 6 步「候选表列表」中的**每个** `dataview_id`（有多个则逐一处理），向数据模型服务请求该数据视图的元信息，读取返回体中的 `operations` 数组/列表。执行前 `kweaver` 应已完成 **auth** 与当前问数**同一平台**的上下文。请求路径形态为 `GET`：

   `/api/mdl-data-model/v1/data-views/<dataview_id>`

   其中 **`<dataview_id>`** 为第 6 步中对应行的 UUID。执行时直接使用相对 API 路径（不拼接平台根 URL），响应一般为 JSON 数组，取 `[0].operations`（以实际响应为准）。

   - **通过条件**：`operations` 中**包含**字符串 **`data_query`**，视为**具备数据查询（查询数据）能力**，该候选在本步**通过**。
  - **无权限即停**：若任一候选 `operations` 中不含 `data_query`，**立即终止**问数流程，**不得**进入第 8 步及以后步骤。须明确提示用户通过子技能 [`smart-apply-data-auth.md`](smart-apply-data-auth.md) 为对应 `dataview_id` 申请 `data_query`（数据查询）权限后再重试。
  - **失败即停**：若接口失败导致无法判权且无法补救，**立即终止**问数流程并返回真实错误；仅当本步参与后续查询的候选均已确认包含 `data_query` 时，方可进入第 9 步。**多表 JOIN 问数**时，最终 SQL 中**每一个**会参与 `dataview query` 的 `dataview_id` 都必须在本步通过 `data_query` 校验，任一不通过即终止并提示申请对应视图权限。
  - **Windows（PowerShell）**（将示例中的 `dataview_id` 替换为第 6 步列表中的真实值；`ConvertFrom-Json` 前须避免管道损坏 UTF-8，建议**落盘**再读；多个 id 可循环执行）：

     ```powershell
     $out = Join-Path $env:TEMP 'dv-6110a40a.json'
     chcp 65001 | Out-Null
     cmd /c "kweaver curl `"/api/mdl-data-model/v1/data-views/6110a40a-1585-4d3b-bfc0-602e678d190d`" -X GET 2>nul > `"$out`""
     (Get-Content -Path $out -Raw -Encoding utf8 | ConvertFrom-Json)[0].operations
     ```

     对输出列表判断：若其中包含 `data_query`，则具备查询权限。

   - **Linux（bash 等）**（同样仅替换 `dataview_id`）：

     ```bash
     kweaver curl "/api/mdl-data-model/v1/data-views/6110a40a-1585-4d3b-bfc0-602e678d190d" -X GET 2>/dev/null \
       | python3 -c "import json,sys; d=json.load(sys.stdin); print(*d[0]['operations'], sep='\n')"
     ```

     在管道场景下，若因编码导致 `json.load` 失败，可改为**先**将 `kweaver curl` 输出**重定向到 UTF-8 文件**后，用 `python3 -c "import json; print(json.load(open('...',encoding='utf-8'))[0]['operations'])"` 解析（与 Windows 落盘再解析同理）。

8. **获取候选表详情**：对**第 7 步已通过**权限校验的 `dataview_id`，使用 `kweaver dataview get <dataview_id>` 获取字段、主键、数据源等结构化详情，用于确认可查询性与第 9 步参数依据（若上一步有多个有权限的候选，可按第 9 步需要全部拉取或只拉将参与查询的表）。
9. **查询数据（含分流与结果返回）**：本步必须先完成“是否联表”判定并产出查询结果。**分流顺序固定如下**：  
   - **联表查询优先规则（必须）**：若需求涉及两个及以上对象/视图联合（含显式或隐式 JOIN、多视图字段同查、跨对象关联过滤），**直接判定为 `complex_query`**，执行 [`smart-ask-data-sql-query.md`](smart-ask-data-sql-query.md)。  
   - **非联表默认简单规则（必须）**：若需求可在单对象内完成，优先按简单查询执行 [`smart-ask-data-structured-and-metric-query.md`](smart-ask-data-structured-and-metric-query.md)（含 `dsl_query` 与 `metric_aggregation`，其中 `simple_detail` 为 `dsl_query` 兼容别名、`simple_aggregation` 为 `metric_aggregation` 兼容别名）。  
   - **同环比指标优先规则（新增，必须）**：非联表场景下，当用户**明确要求查询“同比/环比”结果**且未要求解读/归因等洞察输出时，优先判定为 `metric_aggregation`（兼容别名 `simple_aggregation`）并进入指标流程（优先使用 `metric_sameperiod_compare.py`；必要时结合 `metric_time_window_trend.py` / `metric_compare.py`）。仅当指标流程无可用指标、脚本执行失败且无法修复时，才允许按“简单失败兜底规则”降级 `complex_query`。  
   - **简单失败兜底规则（必须）**：非联表场景下，若已按简单查询规范执行后仍因能力边界无法完成（如表达能力不足、所需计算超出简单分支定义），方可切换至 [`smart-ask-data-sql-query.md`](smart-ask-data-sql-query.md) 作为兜底；切换时需保留真实失败原因，不得伪造“简单查询已完成”。  
   - 不得跨分支使用未规定命令替代执行。**必须严格参考对应分支的指定文档执行，不得自行变更执行路径或命令。**  
   - **简单查询组合判定（新增）**：当同一需求同时包含 `dsl_query` 与 `metric_aggregation` 两部分时，仍归类为**简单查询**，应按简单查询分支执行；仅在出现超出简单查询能力边界的语义/计算要求时，才归类为 `complex_query`。  
   - **同环比分流示例（新增）**：  
    - 示例 A：「以周为单位，查询企业数量的同环比」→ `metric_aggregation`（指标流程优先）。  
     - 示例 B：「以周为单位，查询企业数量同环比并分析原因」→ 由总入口路由数据洞察；若洞察内需取数，仍先走第 9 步简单分支并优先指标流程。  
   - **查询类型显式输出（必须）**：第 9 步完成后，输出结果中必须显式声明本次选择的查询类型，且仅可为以下三类之一：`dsl_query`（结构化明细查询，兼容别名 `simple_detail`）、`metric_aggregation`（指标聚合/对比/趋势；兼容别名 `simple_aggregation`）、`complex_query`（复杂查询）。  
   - 推荐输出格式：`查询类型：dsl_query | metric_aggregation | complex_query`（可附中文释义）。
10. **画图需求分支（按用户问题触发）**：当用户明确提出“画柱状图/饼图/折线图/散点图”等需求时，调用 [`smart-json2plot.md`](smart-json2plot.md)；基于第 9 步产出的结构化数据生成图表数据，并按 Markdown + 标识符格式输出（不直接出图）。
11. **总结结果**：统一展示候选表与查询结果（不展示 SQL 原文）。候选表需至少包含：候选表名称、候选表 id、入选理由；查询结果必须以表格方式展示，确保用户可直接核对字段与取值。若第 10 步已触发，还需合并展示图表数据结果。若第 6 步存在多主体域候选，需在本步显式说明“最终采用口径”与“未采用候选原因”。

## 输出要求

1. 候选表信息（至少包含候选表名称、候选表 id、入选理由）
2. 查询结果（明细或聚合，表格展示）
3. 最小口径说明（时间、过滤、KN；若默认 `LIMIT 200` 被覆盖或未适用，一并说明）
4. 查询类型声明（来自第 9 步分流结果：`dsl_query` / `metric_aggregation` / `complex_query`；兼容别名 `simple_detail`、`simple_aggregation`）
5. 若触发画图需求：补充 `smart-json2plot` 生成的图表数据（Markdown + 标识符）

## 不做事项

- 不做业务解读、归因、建议
- 不直接进行图表出图（仅在需要时调用 `smart-json2plot` 生成绘图数据）
- 不做代码二次加工

## 失败处理

- 明确报错原因（口径缺失、权限不足、无命中、执行失败）
- 总入口已路由为问数时，对**可识别的公历日期/区间**若校验不通过，在**进入子流程前**即停止（见 `smart-data-analysis` 总入口第 3 步「问数前：日期及区间合法性」）
- 第 9 步若**公历日期或日期区间不合法**（或 SQL 中仍将出现非法日期字面量），须在本步内停止执行并向用户说明无效处，请修正后重试
- 第 6 步若出现 `error_details` 含 **`Access denied: insufficient permissions for [view_detail]`**，须按上文第 6 步专条提示用户配置 **`view_detail`（视图详情）** 权限，不得进入后续步骤
- 第 7 步若任一候选缺少 `data_query`，须立即终止流程，并提示用户调用 [`smart-apply-data-auth.md`](smart-apply-data-auth.md) 申请对应 `dataview_id` 的 `data_query` 权限后重试
- 第 6 步若出现 `error_details` 含 **`DefaultSmallModelEnabled is false`**，须**立即停止流程**，并按上文第 6 步专条提示用户在 **`bkn-backend` 服务**配置**向量模型**，不得进入后续步骤
- 给出下一步补充建议
- 不切换到“找数”分支伪造结果
- 第 9 步执行失败时，不改用其它命令或工具替代规定命令重试取数（简单条件明细分支为 `query-object-instance`，简单条件聚合与复杂查询分支为 `dataview query`，见上文「第 6–9 步命令与路径限定」）

## 命令行转义注意事项（PowerShell / Linux）

- 默认使用变量传 SQL，避免手工转义：
  - PowerShell：`$sql = @' ... '@`
  - Linux（bash/zsh）：`sql=$(cat <<'SQL' ... SQL)`
- 在 SQL 块内，`LIKE '%关键词%'` 保持单引号一层，不要写成 `''%关键词%''`。
- 表名/库名按 SQL 规范使用双引号，例如：`"adp_gzfrk"."scjg_e_baseinfo"`。
- 避免将 SQL 直接拼成单行字符串并手工转义；优先变量传参：
  - PowerShell：`--sql $sql`
  - Linux（bash/zsh）：`--sql "$sql"`
- 若必须单行命令再使用 `--sql '<sql>'`，并显式处理引号冲突。
