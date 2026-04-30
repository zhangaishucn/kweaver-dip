# smart-search-tables 查询命令模板（按需加载）

用于承载 `smart-search-tables.md` 第 6 步的命令模板与参数防错细则。

> **与主流程步号对齐**：找数全流程为第 **5–10** 步。第 6 步为本文件的实例检索；其后为第 7 步筛选视图、第 8 步权限校验、第 9 步职责查询（按触发）、第 10 步总结结果。详见 [`smart-search-tables.md`](smart-search-tables.md)。

## 适用范围

- 场景：执行 `kweaver context-loader query-object-instance <知识网络id> <查询命令>` 检索元数据实例
- 目标：稳定构造参数，避免 `Invalid JSON argument` 等格式错误

## PowerShell 命令参数防错（必须遵守）

- 禁止手写多层转义字符串（高概率触发 `Invalid JSON argument`）。
- 必须使用“对象组装 -> `ConvertTo-Json` -> 本地校验 -> 自动转义 -> 命令调用”的固定流程。
- `query-object-instance` 的入参始终来自变量 `$jsonEscaped`，不得直接内联 JSON。
- 第 6 步命令必须显式携带 `<知识网络id>`（如 `<kn_id_find_table>`）。

### PowerShell 模板

```powershell
$knId = "<kn_id_find_table>"
$query = "用户问题"
$payload = @{
  ot_id = "metadata"
  condition = @{
    operation = "or"
    sub_conditions = @(
      @{ field = "embeddings_text"; operation = "match"; value = $query }
      @{ limit_value = 1000; field = "embeddings_text"; operation = "knn"; value = $query; limit_key = "k" }
    )
  }
  limit = 5
}
$jsonArg = $payload | ConvertTo-Json -Depth 8 -Compress
$null = $jsonArg | ConvertFrom-Json
$jsonEscaped = $jsonArg -replace '"','\"'
kweaver context-loader query-object-instance $knId $jsonEscaped
```

### PowerShell：`knn` 失败降级重试（必须遵守）

```powershell
$knId = "<kn_id_find_table>"
$query = "用户问题"

# 首次：match + knn
$payload = @{
  ot_id = "metadata"
  condition = @{
    operation = "or"
    sub_conditions = @(
      @{ field = "embeddings_text"; operation = "match"; value = $query }
      @{ limit_value = 1000; field = "embeddings_text"; operation = "knn"; value = $query; limit_key = "k" }
    )
  }
  limit = 30
}
$jsonArg = $payload | ConvertTo-Json -Depth 8 -Compress
$null = $jsonArg | ConvertFrom-Json
$jsonEscaped = $jsonArg -replace '"','\"'
$out = kweaver context-loader query-object-instance $knId $jsonEscaped

# 命中 knn 相关错误：去掉 knn，仅 match，重试一次
if ($out -match "vectorizer|knn|ModelFactory|ExternalSmallModel|InvalidParameter\.Condition") {
  $payloadRetry = @{
    ot_id = "metadata"
    condition = @{
      operation = "or"
      sub_conditions = @(
        @{ field = "embeddings_text"; operation = "match"; value = $query }
      )
    }
    limit = 30
  }
  $jsonArgRetry = $payloadRetry | ConvertTo-Json -Depth 8 -Compress
  $null = $jsonArgRetry | ConvertFrom-Json
  $jsonEscapedRetry = $jsonArgRetry -replace '"','\"'
  kweaver context-loader query-object-instance $knId $jsonEscapedRetry
} else {
  $out
}
```

### 最小自检（必须执行）

- 调用前必须先执行：`$null = $jsonArg | ConvertFrom-Json`
- 调用参数必须先执行：`$jsonEscaped = $jsonArg -replace '"','\"'`
- 若校验失败，立即返回原始报错并停止，不得继续调用 `query-object-instance`。

## Linux（bash/zsh）命令参数防错（必须遵守）

- Linux 下优先使用单引号包裹参数，避免 shell 二次解释双引号。
- 允许两种模板：直接写（简单场景）和变量组装（推荐）。
- 若直接写失败，再切换变量组装模板。

### Linux 直接写版本

```bash
kweaver context-loader query-object-instance <kn_id_find_table> '{\"ot_id\":\"metadata\",\"condition\":{\"operation\":\"or\",\"sub_conditions\":[{\"field\":\"embeddings_text\",\"operation\":\"match\",\"value\":\"用户问题\"},{\"limit_value\":1000,\"field\":\"embeddings_text\",\"operation\":\"knn\",\"value\":\"用户问题\",\"limit_key\":\"k\"}]},\"limit\":5}'
```

### Linux 变量组装版本（推荐）

```bash
kn_id="<kn_id_find_table>" && query="绿色食品认证 生产企业 企业名称 核准产量" && json=$(jq -nc --arg q "$query" '{ot_id:"metadata",condition:{operation:"or",sub_conditions:[{field:"embeddings_text",operation:"match",value:$q},{limit_value:1000,field:"embeddings_text",operation:"knn",value:$q,limit_key:"k"}]},limit:30}') && json_escaped=$(printf '%s' "$json" | sed 's/"/\\"/g') && echo "JSON: $json" && echo "Escaped: $json_escaped" && kweaver context-loader query-object-instance "$kn_id" "$json_escaped"
```

### Linux：`knn` 失败降级重试（必须遵守）

```bash
kn_id="<kn_id_find_table>"
query="用户问题"
json=$(jq -nc --arg q "$query" '{ot_id:"metadata",condition:{operation:"or",sub_conditions:[{field:"embeddings_text",operation:"match",value:$q},{limit_value:1000,field:"embeddings_text",operation:"knn",value:$q,limit_key:"k"}]},limit:30}')
json_escaped=$(printf '%s' "$json" | sed 's/"/\\"/g')
out=$(kweaver context-loader query-object-instance "$kn_id" "$json_escaped" 2>&1) || true
if printf '%s' "$out" | grep -Eq 'vectorizer|knn|ModelFactory|ExternalSmallModel|InvalidParameter\.Condition'; then
  json_retry=$(jq -nc --arg q "$query" '{ot_id:"metadata",condition:{operation:"or",sub_conditions:[{field:"embeddings_text",operation:"match",value:$q}]},limit:30}')
  json_escaped_retry=$(printf '%s' "$json_retry" | sed 's/"/\\"/g')
  kweaver context-loader query-object-instance "$kn_id" "$json_escaped_retry"
else
  printf '%s\n' "$out"
fi
```
