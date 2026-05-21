# 行规则（row_rules）使用示例

实现与校验逻辑见本仓库 `dsg/services/apps/auth-service/domain/data_auth/conditions/parse.go`（`ParseSQLCondition`）及 `parse_test.go`。申请链路中 `resource_attributes[].row_rules` 经 `parseRowRules`：先尝试 JSON，失败则按 SQL 字符串解析（整段一条表达式）。

## 书写约定

- **列名**：双引号，如 `"status"`、`"create_time"`。
- **字符串字面量**：单引号，如 `'ok'`、`'2026-05-13 00:00:00'`。
- **逻辑组合**：顶层 `AND` / `OR`，嵌套可用括号 `(...)`。
- **空字符串**：表示无行过滤（合法）。
- **整体形态**：须能被一次性解析；勿混用别接口里「分号拼接多段条件」的约定（见文末说明）。

## 比较运算

```text
"status" = 'ok'
"score" >= 60
"id" <> 0
```

`=`、`<>` 分别映射为条件结构中的 `==`、`!=`。

## IN / NOT IN

```text
"status" IN ('ok','fail')
"id" NOT IN (1,2,3)
```

## LIKE / NOT LIKE（prefix / not_prefix）

仅当模式为 **末尾 `%`、前缀无 `%`** 时映射为 `prefix`；否则为 `like` / `not_like`。

```text
"name" LIKE 'abc%'
"name" NOT LIKE '%tmp%'
```

## IS NULL / IS NOT NULL、布尔

```text
"c" IS NULL
"owner" IS NOT NULL
"enabled" = true
"flag" = false
```

## 顶层 AND / OR 与括号

```text
"a" = 1 AND ("b" LIKE 'abc%' OR "c" IS NULL)
```

## 数值区间与区间外（range / out_range）

```text
"score" >= 60 AND "score" < 100
("age" < 18 OR "age" >= 60)
```

## empty / not_empty（固定复合形式，同一字段出现两次）

```text
"x" IS NULL OR "x" = ''
"x" IS NOT NULL AND "x" <> ''
```

## BETWEEN（含 DATE_TRUNC 日期形态）

```text
"create_time" BETWEEN DATE_TRUNC('minute', CAST('2026-05-13 00:00:00' AS TIMESTAMP)) AND DATE_TRUNC('minute', CAST('2026-05-13 23:59:59' AS TIMESTAMP))
```

## REGEXP_LIKE

```text
REGEXP_LIKE("name", '^ab.*')
```

## json_array_contains / NOT（contain / not_contain）

同字段多条 `AND` 可合并为单个 `contain` / `not_contain` 多值：

```text
json_array_contains("tags", 'prod')
json_array_contains("tags", 'prod') AND json_array_contains("tags", 'stable')
NOT json_array_contains("tags", 'test') AND NOT json_array_contains("tags", 'deprecated')
```

## before（须与解析器约定的 DATE_add + 时区形态一致）

```text
"ts" >= DATE_add('day', -7, CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AND "ts" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'
```

## JSON 条件树（可选）

若更易维护结构化条件，可直接传入可反序列化为 `RowColumnCondCfg` 的 JSON（与 `idrm-go-common/rest/data_model` 中结构一致）。解析优先级：**JSON 优先于 SQL 字符串**。

## 与「分号分隔」说明

部分**其它 API**（例如部分虚拟化下载参数）文档中可能写「多个条件以 `;` 隔开」。**权限申请**路径下 `row_rules` 按**整段** SQL（或 JSON）校验，请用 `AND` / `OR` 组合语义，不要依赖 `;` 拆段。
