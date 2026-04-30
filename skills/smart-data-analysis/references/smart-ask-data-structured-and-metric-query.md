# 结构化与指标查询（smart-ask-data）

本文件用于 `smart-ask-data` 在“非 SQL 复杂查询”场景下的执行规范：  
单对象明细走 `query-object-instance`；聚合与对比走指标脚本。

## 适用场景

- 简单条件明细查询（单对象、可直接按字段过滤）
- 简单聚合查询（计数、去重计数、求和、均值、最值）
- 对比与结构分析（A/B 条件对比、分组占比、时间趋势、同环比）

## 执行目标

- 明细：使用 `kweaver context-loader query-object-instance`
- 聚合：使用 `skills/smart-data-analysis/scripts` 下指标脚本
- 不进入 SQL 复杂查询分支

## 强约束

1. 聚合问题必须走指标流程，不使用 `kweaver dataview query` 直接聚合。
2. 指标执行失败即停，返回真实报错，不旁路改用其它工具。
3. 分组查询必须同时检查：
   - 请求体里有 `analysis_dimensions`
   - 指标定义里有 `calculation_formula.group_by`
4. 同环比统一术语：`metrics.type=sameperiod`（不要使用 `parallel`）。

## 指标流程（必须）

1) 搜索指标  
`kweaver context-loader search-schema <指标知识网络id> <关键词> --scope metric --max 5`

- 若无命中，执行兜底：
  - `skills/smart-data-analysis/scripts/metric_list.py`
  - `--account-id` 必须取 `kweaver auth whoami` 的 `user_id`

2) 执行指标  
根据场景选择下列脚本（见“脚本场景清单”）。

## 脚本场景清单

- `metric_list.py`  
  - 指标检索兜底：列出知识网络内指标清单

- `metric_group_filter_aggregate.py`  
  - 分组 + 条件混合聚合（计数、去重计数、求和、均值、最值）

- `metric_compare.py`  
  - 同一指标 A/B 条件对比
  - 分组结构/占比对比（`--proportion`）

- `metric_time_window_trend.py`  
  - 时间趋势（`day/week/month`）
  - 时间 + 业务维度联合分组（`--group-fields`）

- `metric_sameperiod_compare.py`  
  - 同环比（`metrics.type=sameperiod`）
  - 支持 `offset`、`time_granularity`、`method`

## 推荐命令模板

### 1) 明细查询（PowerShell）

```powershell
$knId = "<问数知识网络id>"
$payload = @{
  ot_id = "scjg_e_baseinfo"
  condition = @{
    operation = "and"
    sub_conditions = @(
      @{ field = "estdate"; operation = "=="; value_from = "const"; value = "2024-02-29" }
    )
  }
  limit = 200
}
$jsonArg = $payload | ConvertTo-Json -Depth 8 -Compress
$null = $jsonArg | ConvertFrom-Json
$jsonEscaped = $jsonArg -replace '"','\"'
kweaver context-loader query-object-instance $knId $jsonEscaped
```

### 2) 条件 + 分组聚合

```powershell
python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --group-fields regstate_cn `
  --logic and `
  --cond "regcap,>,number,1000" `
  --bearer "<TOKEN>" `
  --account-id <USER_ID> `
  --account-type user `
  -bd <BUSINESS_DOMAIN> `
  --insecure
```

### 3) A/B 对比

```powershell
python skills/smart-data-analysis/scripts/metric_compare.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --cond-a "regstate_cn,==,string,注销" `
  --cond-b "regstate_cn,==,string,存续" `
  --bearer "<TOKEN>" `
  --account-id <USER_ID> `
  --account-type user `
  -bd <BUSINESS_DOMAIN> `
  --insecure
```

### 4) 时间趋势（按月）

```powershell
python skills/smart-data-analysis/scripts/metric_time_window_trend.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --bearer "<TOKEN>" `
  --account-id <USER_ID> `
  --account-type user `
  -bd <BUSINESS_DOMAIN> `
  --insecure
```

### 5) 时间 + 业务维度（按月 + 状态）

```powershell
python skills/smart-data-analysis/scripts/metric_time_window_trend.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --group-fields regstate_cn `
  --bearer "<TOKEN>" `
  --account-id <USER_ID> `
  --account-type user `
  -bd <BUSINESS_DOMAIN> `
  --insecure
```

### 6) 同环比（sameperiod）

```powershell
python skills/smart-data-analysis/scripts/metric_sameperiod_compare.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --offset 1 `
  --granularity month `
  --methods growth_value,growth_rate `
  --bearer "<TOKEN>" `
  --account-id <USER_ID> `
  --account-type user `
  -bd <BUSINESS_DOMAIN> `
  --insecure
```

## 已知易错点

- `--cond` 必须整体加引号（尤其 PowerShell，避免 `>` 被解释）。
- `analysis_dimensions` 与指标定义 `group_by` 缺一不可，否则可能只返回总量。
- 同环比必须是 `metrics.type=sameperiod`，并提供合理的时间范围与粒度。
- 同环比结果若出现 `growth_values` / `growth_rates = null`，必须检查时间序列是否连续（如缺失某月）或是否为首个时间点。

## 执行后输出要求

1. 返回可复核数据结果（明细或聚合）。
2. 给出最小口径说明（时间范围、过滤条件、分组维度、指标口径）。
3. 若同环比结果中出现 `null`，必须将 `times` 转换为可读时间（如 `YYYY-MM`），并明确展示缺失的时间点（例如“缺失 2025-08”）。
4. 失败时返回真实错误，不绕过流程。
# 第9步：简单条件查询（聚合走指标，smart-ask-data）

本文件定义 `smart-ask-data` 第 9 步在“简单条件筛选 + 聚合改走指标”场景下的执行规范。

分支边界声明：本文件适用于第 9 步简单条件查询分支；其中聚合问题必须走指标流程，不得用复杂查询命令替代执行。

## 适用场景

当第 9 步完成分流判断后，若问题被判定为“简单条件查询问题”（包含明细筛选与简单聚合），必须执行本文件流程。

## 执行目标

按分流使用以下方式完成查询并返回结果，不进入复杂查询分支：
- 简单条件明细：使用 `kweaver context-loader query-object-instance`
- 简单条件聚合（计数、去重计数、求和、平均、最值等）：使用指标流程（`metric_group_filter_aggregate.py`）
- 对比类聚合（A/B 条件对比、分组占比/结构对比）：使用 `metric_compare.py`

## 简单聚合处理（计数/求和等，统一走指标）

当用户问题属于**简单条件下的聚合计算**（如总数、计数、去重计数、求和、平均、最大/最小）时，不应使用对象实例明细查询方式，也不再使用 `kweaver dataview query` 直接做聚合 SQL，必须在本分支内切换为指标流程执行。

- 指标结构建模：指标通过 `scope`（所属对象类）、计算公式（过滤条件 + 聚合方式 + 分组字段）、时间维度、分析维度等要素完整描述业务量化逻辑。当前支持原子指标类型（`atomic`），复合指标类型后续迭代补充。
- 多维查询模式：
  - 即时查询：`instant=true`，获取当前汇总值。
  - 趋势查询：`instant=false` + 时间范围，按日/月/年等日历步长返回时序数据。
  - 同环比分析：`type=parallel`，配置偏移量后计算增长值与增长率。
  - 占比分析：`type=proportion`，按分析维度返回各维度占比百分比。

### 指标流程（必须）

1. 搜索相关指标  
   命令：  
   `kweaver context-loader search-schema <指标知识网络id> <用户问题关键词> --scope metric --max 5`
   - 若 `context-loader search-schema` 无命中、返回空列表或无法定位可用指标，必须立即执行指标列表兜底脚本：`skills/smart-data-analysis/scripts/metric_list.py`，先获取当前指标知识网络下的指标清单，再基于指标名称/注释/维度字段筛选候选指标。
   - `metric_list.py` 的 `--account-id` 必须通过 `kweaver auth whoami` 返回的 `user_id` 获取，不得手填固定值。  
   - 兜底脚本示例（PowerShell）：  
     `$uid = (kweaver auth whoami | ConvertFrom-Json).user_id; python skills/smart-data-analysis/scripts/metric_list.py --kn-id <指标知识网络id> --bearer "<TOKEN>" --account-id $uid --account-type user --insecure --limit 100`

2. 执行指标  
   使用 `smart-data-analysis/scripts` 目录中的指标执行脚本：`metric_group_filter_aggregate.py`、`metric_compare.py`、`metric_time_window_trend.py`、`metric_sameperiod_compare.py`（若第 1 步已走兜底，可先用 `metric_list.py` 得到的候选指标 id 再执行）。

### 脚本场景清单（第 9 步）

- `metric_list.py`：当 `context-loader` 搜索不到指标时，列出指标知识网络中的可用指标清单（用于兜底选型）。
- `metric_group_filter_aggregate.py`：分组 + 条件混合聚合（计数、去重计数、求和、均值、最值等）。
- `metric_compare.py`：同一指标下 A/B 条件对比；或分组结构/占比对比（`--proportion`）。
- `metric_time_window_trend.py`：时间趋势统计（按天/周/月等时间粒度），支持时间 + 业务维度联合分组（`--group-fields`）。
- `metric_sameperiod_compare.py`：同环比分析（`metrics.type=sameperiod`，支持 `offset`、`time_granularity`、`method`）。

### 时间趋势脚本使用场景（time-window trend）

当用户问题是“按天/周/月趋势如何变化”“近30天走势”等时间趋势统计，或“按月 + 状态”这类时间 + 业务维度联合分组时，使用 `metric_time_window_trend.py`。

脚本路径：
- `skills/smart-data-analysis/scripts/metric_time_window_trend.py`

PowerShell 示例（按月趋势）：

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_time_window_trend.py `
  --kn-id d7o7gil4g3h4iis9fvg0 `
  --metric-id d7on6jd4g3h4iis9fvug `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  --bearer $t `
  -bd bd_public `
  --insecure
```

PowerShell 示例（按月 + 状态联合分组）：

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_time_window_trend.py `
  --kn-id d7o7gil4g3h4iis9fvg0 `
  --metric-id d7on6jl4g3h4iis9fvvg `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --group-fields regstate_cn `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  --bearer $t `
  -bd bd_public `
  --insecure
```

PowerShell 示例（单条件）：

```powershell
python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py `
  --kn-id <指标知识网络id> `
  --metric-id <指标ID> `
  --group-fields <分组字段> `
  --logic and `
  --cond "<字段名>,==,string,<筛选值>" `
  --insecure
```

Linux 示例（多条件）：

```bash
python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py \
  --kn-id <指标知识网络id> \
  --metric-id <指标ID> \
  --group-fields <分组字段1>,<分组字段2> \
  --logic and \
  --cond "<字段1>,==,string,<值1>" \
  --cond "<字段2>,>,number,<值2>" \
  --insecure
```

### 指标查询案例（实测）

以下案例基于已验证指标：
- `kn_id`: `d7lj3i54g3h4iis9fubg`
- `metric_id`: `d7nidst4g3h4iis9fur0`
- 业务含义：统计企业状态对象类型总数（可按条件筛选）

1. 单条件查询：企业状态 = 注销

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py `
  --kn-id d7lj3i54g3h4iis9fubg `
  --metric-id d7nidst4g3h4iis9fur0 `
  --group-fields regstate_cn `
  --logic and `
  --cond "regstate_cn,==,string,注销" `
  --bearer $t `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  -bd bd_public `
  --insecure
```

期望返回关键值：
- `datas[0].values[0] = 89`

2. 多条件查询（AND）：企业状态 = 注销 且 注册资本 > 1000

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_group_filter_aggregate.py `
  --kn-id d7lj3i54g3h4iis9fubg `
  --metric-id d7nidst4g3h4iis9fur0 `
  --group-fields regstate_cn `
  --logic and `
  --cond "regstate_cn,==,string,注销" `
  --cond "regcap,>,number,1000" `
  --bearer $t `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  -bd bd_public `
  --insecure
```

期望返回关键值：
- `datas[0].values[0] = 74`

注意（PowerShell）：
- `--cond` 参数必须整体加引号，例如 `"regcap,>,number,1000"`，避免 `>` 被解释为重定向符。

### 分组 + 条件混合聚合经验（必须遵守）

当需求是“按某维度分组，同时叠加条件过滤”（例如按 `regstate_cn` 分组，且 `regcap > 1000`）时，必须同时满足以下两点：

1. **请求体传分组维度**  
   在查询请求中传 `analysis_dimensions`（或实现支持时的 `group_by`）。

2. **指标定义中显式配置 group_by**  
   在指标定义 `calculation_formula` 中配置 `group_by`。仅在请求体里传分组字段而指标定义缺失 `group_by` 时，可能只返回总量，`labels` 为空。

#### 建议配置示例（指标定义片段）

```json
{
  "calculation_formula": {
    "aggregation": {
      "property": "pripid",
      "aggr": "count"
    },
    "group_by": [
      {
        "property": "regstate_cn"
      }
    ]
  }
}
```

#### 建议查询示例（请求体片段）

```json
{
  "analysis_dimensions": ["regstate_cn"],
  "condition": {
    "operation": "and",
    "sub_conditions": [
      {"field": "regcap", "operation": ">", "value_from": "const", "value": 1000}
    ]
  },
  "limit": 200
}
```

### 对比类聚合脚本使用场景（A/B 条件对比 + 分组占比/结构对比）

当用户问题是“同一指标在两个不同条件下如何对比”（例如 注销 vs 存续、地区A vs 地区B），或“各分组在总量中的占比/结构如何”时，优先使用 `metric_compare.py`，避免手工多次执行和人工换算。

脚本路径：
- `skills/smart-data-analysis/scripts/metric_compare.py`

参数约定：
- A/B 模式：`--cond-a` / `--cond-b` 格式 `field,op,value_type,value`
- 分组模式：`--group-fields` 指定分组字段，`--proportion` 开启占比（`metrics.type=proportion`）
- `value_type` 支持：`string` / `number` / `bool`
- A/B 输出：`value_a`、`value_b`、`delta_a_minus_b`、`ratio_a_div_b`
- 分组输出：`rows[].labels`、`rows[].value`、`rows[].proportion`（启用 `--proportion` 时）

PowerShell 示例：

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_compare.py `
  --kn-id d7o7gil4g3h4iis9fvg0 `
  --metric-id d7omjnl4g3h4iis9fvrg `
  --cond-a "regstate_cn,==,string,注销" `
  --cond-b "regstate_cn,==,string,存续" `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  --bearer $t `
  -bd bd_public `
  --insecure
```

PowerShell 示例（分组占比/结构对比）：

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_compare.py `
  --kn-id d7o7gil4g3h4iis9fvg0 `
  --metric-id d7omjo54g3h4iis9fvsg `
  --group-fields regstate_cn `
  --proportion `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  --bearer $t `
  -bd bd_public `
  --insecure
```

适用边界：
- 适用：同一指标、同一统计口径下的两组条件对比；按分组返回结构及占比。
- 不适用：多指标联动对比、跨时间同环比（请使用 `metrics.type=sameperiod` 或时间窗口脚本）。

### 同环比脚本使用场景（sameperiod）

当用户问题是“按月环比/同比变化”“上一周期增减值与增减率”等时间对比分析时，使用 `metric_sameperiod_compare.py`。

脚本路径：
- `skills/smart-data-analysis/scripts/metric_sameperiod_compare.py`

PowerShell 示例（按月环比）：

```powershell
$t = kweaver token
python skills/smart-data-analysis/scripts/metric_sameperiod_compare.py `
  --kn-id d7o7gil4g3h4iis9fvg0 `
  --metric-id d7om73t4g3h4iis9fvpg `
  --start-ms 1704067200000 `
  --end-ms 1893456000000 `
  --step month `
  --offset 1 `
  --granularity month `
  --methods growth_value,growth_rate `
  --account-id ff8ef3da-3e12-11f1-8993-261248b384b3 `
  --account-type user `
  --bearer $t `
  -bd bd_public `
  --insecure
```

## 执行命令（必须）

### A. 简单条件明细（`query-object-instance`）

#### PowerShell 模板（推荐）

```powershell
$knId = "<问数知识网络id>"
$payload = @{
  ot_id = "scjg_e_baseinfo"
  condition = @{
    operation = "and"
    sub_conditions = @(
      @{ field = "estdate"; operation = "=="; value_from = "const"; value = "2024-02-29" }
    )
  }
  limit = 200
}
$jsonArg = $payload | ConvertTo-Json -Depth 8 -Compress
$null = $jsonArg | ConvertFrom-Json
$jsonEscaped = $jsonArg -replace '"','\"'
kweaver context-loader query-object-instance $knId $jsonEscaped
```

#### Linux 直接写版本

```bash
kweaver context-loader query-object-instance <问数知识网络id> '{\"ot_id\":\"scjg_e_baseinfo\",\"condition\":{\"operation\":\"and\",\"sub_conditions\":[{\"field\":\"estdate\",\"operation\":\"==\",\"value_from\":\"const\",\"value\":\"2024-02-29\"}]},\"limit\":200}'
```

#### Linux 变量组装版本（推荐）

```bash
kn_id="<问数知识网络id>" && ot_id="scjg_e_baseinfo" && date_value="2024-02-29" && json=$(jq -nc --arg ot "$ot_id" --arg d "$date_value" '{ot_id:$ot,condition:{operation:"and",sub_conditions:[{field:"estdate",operation:"==",value_from:"const",value:$d}]},limit:200}') && json_escaped=$(printf '%s' "$json" | sed 's/"/\\"/g') && kweaver context-loader query-object-instance "$kn_id" "$json_escaped"
```

## 执行要求

1. 保持命令结构与参数契约一致。  
2. 明细查询使用 `ot_id`、`condition`、`limit`；简单聚合查询统一使用指标流程（`metric_group_filter_aggregate.py`）。  
3. 必须在本分支内拿到可复核查询结果；若执行失败，按主流程强约束立即停止。  
4. 成功后直接将查询结果交给后续第 10 步/第 11 步，不再走复杂查询分支。  
5. 聚合结果的行数、维度与时间粒度由指标请求体约束，不再以 `dataview query` 的 `LIMIT` 规则为准。  

## 命令参数防错（必须遵守）

- 禁止手写多层转义字符串（高概率触发 `Invalid JSON argument`）。
- 必须优先使用“对象组装 -> `ConvertTo-Json` -> 本地校验 -> 自动转义 -> 命令调用”流程。
- `query-object-instance` 入参建议来自变量（如 `$jsonEscaped`），不要直接内联复杂 JSON。
- `condition` 必须显式提供（至少含 `operation` 与 `sub_conditions`）。

### 最小自检（必须执行）

- 调用前先执行：`$null = $jsonArg | ConvertFrom-Json`
- 调用参数先执行：`$jsonEscaped = $jsonArg -replace '"','\"'`
- 若校验失败，立即返回原始报错并停止，不得继续调用 `query-object-instance`。
