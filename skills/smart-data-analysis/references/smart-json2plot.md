# smart-json2plot（图表数据子技能）

用于将结构化数据转换为可绘图的数据结构，不直接出图。

## 使用场景

- 用户明确要求生成图表数据（不是直接画图）
- 已有可复核的结构化数据结果
- 需要为前端或下游工具准备统一图表数据

## 输入要求

- `structured_data`：结构化数据（对象数组，JSON 行数据）
- `chart_type`：`bar` / `pie` / `line` / `scatter`
- 可选：`title`、`x_field`、`y_field`、`series_field`、`source_note`

## 强约束

1. 数据来源必须是可复核的结构化数据，不得编造数据。
2. 仅支持四类图表：柱状图、饼图、折线图、散点图。
3. 仅输出“画图所需数据”，不输出图像、不做业务解读。
4. 输出必须是 Markdown，并附带可定位标识符。

## 处理流程

1. 校验 `structured_data` 非空，且字段可映射到目标图表。
2. 按图表类型提取维度字段与数值字段。
3. 生成统一输出对象：
   - `plot_id`：唯一标识符，例如 `PLOT-BAR-001`
   - `creator`：固定为 `smart-json2plot`，用于标注数据生成来源
   - `chart_type`：图表类型
  - `source`：来源说明（可追溯，如问数结果标识/数据集名称）
   - `encoding`：字段映射关系
   - `data`：绘图数据
4. 按“输出模板”返回 Markdown。

## 图表数据结构约定

### 1) 柱状图（bar）

- `encoding.x`：分类字段
- `encoding.y`：数值字段
- `data`：`[{ "x": "...", "y": 123 }]`

### 2) 饼图（pie）

- `encoding.name`：分类字段
- `encoding.value`：数值字段
- `data`：`[{ "name": "...", "value": 123 }]`

### 3) 折线图（line）

- `encoding.x`：时间/序列字段
- `encoding.y`：数值字段
- `data`：`[{ "x": "...", "y": 123 }]`

### 4) 散点图（scatter）

- `encoding.x`：横轴数值字段
- `encoding.y`：纵轴数值字段
- 可选 `encoding.label`：点标签字段
- `data`：`[{ "x": 1.2, "y": 3.4, "label": "A" }]`

## 输出模板（Markdown + 标识符）

必须按以下模板输出，`plot_id` 要全局唯一：

```markdown
### [PLOT-BAR-001] 柱状图数据
<!-- plot-data:PLOT-BAR-001:start -->

```json
{
  "plot_id": "PLOT-BAR-001",
  "creator": "smart-json2plot",
  "chart_type": "bar",
  "source": "smart-ask-data result",
  "encoding": {
    "x": "地区",
    "y": "企业数量"
  },
  "data": [
    { "x": "云岩区", "y": 120 },
    { "x": "南明区", "y": 98 }
  ]
}
```

<!-- plot-data:PLOT-BAR-001:end -->
```

## 不做事项

- 不执行查询（仅消费上游结构化数据）
- 不输出图像文件
- 不扩展为趋势解读、归因建议
