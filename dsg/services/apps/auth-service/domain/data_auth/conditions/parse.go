package conditions

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
)

const valueFromConst = "const"

var (
	reFieldIsNull           = regexp.MustCompile(`(?is)^"([^"]+)"\s+IS\s+NULL$`)
	reFieldIsNotNull        = regexp.MustCompile(`(?is)^"([^"]+)"\s+IS\s+NOT\s+NULL$`)
	reFieldBool             = regexp.MustCompile(`(?is)^"([^"]+)"\s*=\s*(true|false)$`)
	reRegexLike             = regexp.MustCompile(`(?is)^REGEXP_LIKE\("([^"]+)"\s*,\s*'(.*)'\)$`)
	reJSONContains          = regexp.MustCompile(`(?is)^json_array_contains\("([^"]+)"\s*,\s*(.+)\)$`)
	reNotJSONContains       = regexp.MustCompile(`(?is)^NOT\s+json_array_contains\("([^"]+)"\s*,\s*(.+)\)$`)
	reIn                    = regexp.MustCompile(`(?is)^"([^"]+)"\s+IN\s*\((.*)\)$`)
	reNotIn                 = regexp.MustCompile(`(?is)^"([^"]+)"\s+NOT\s+IN\s*\((.*)\)$`)
	reLike                  = regexp.MustCompile(`(?is)^"([^"]+)"\s+LIKE\s+'(.*)'$`)
	reNotLike               = regexp.MustCompile(`(?is)^"([^"]+)"\s+NOT\s+LIKE\s+'(.*)'$`)
	reCompare               = regexp.MustCompile(`(?is)^"([^"]+)"\s*(=|<>|>=|<=|>|<)\s*(.+)$`)
	reBetweenQuotedDatetime = regexp.MustCompile(`(?is)^"([^"]+)"\s+BETWEEN\s+DATE_TRUNC\('minute',\s*CAST\('([^']*)'\s+AS\s+TIMESTAMP\)\)\s+AND\s+DATE_TRUNC\('minute',\s*CAST\('([^']*)'\s+AS\s+TIMESTAMP\)\)$`)
	reBetween               = regexp.MustCompile(`(?is)^"([^"]+)"\s+BETWEEN\s+(.+)\s+AND\s+(.+)$`)
	reNotEmpty              = regexp.MustCompile(`(?is)^"([^"]+)"\s+IS\s+NOT\s+NULL\s+AND\s+"([^"]+)"\s*<>\s*''$`)
	reEmpty                 = regexp.MustCompile(`(?is)^"([^"]+)"\s+IS\s+NULL\s+OR\s+"([^"]+)"\s*=\s*''$`)
	reRange                 = regexp.MustCompile(`(?is)^"([^"]+)"\s*>=\s*(.+)\s+AND\s+"([^"]+)"\s*<\s*(.+)$`)
	reOutRange              = regexp.MustCompile(`(?is)^\(?\s*"([^"]+)"\s*<\s*(.+)\s+OR\s+"([^"]+)"\s*>=\s*(.+)\s*\)?$`)
	reBefore                = regexp.MustCompile(`(?is)^"([^"]+)"\s*>=\s*DATE_add\('([^']+)'\s*,\s*-(.+)\s*,\s*CURRENT_TIMESTAMP\s+AT\s+TIME\s+ZONE\s+'UTC'\s+AT\s+TIME\s+ZONE\s+'[^']+'\)\s+AND\s+"([^"]+)"\s*<=\s*CURRENT_TIMESTAMP\s+AT\s+TIME\s+ZONE\s+'UTC'\s+AT\s+TIME\s+ZONE\s+'[^']+'$`)
	reCurrentAsRange        = regexp.MustCompile(`(?is)^"([^"]+)"\s*>=\s*from_unixtime\((\d+)\)\s+AND\s+"([^"]+)"\s*<\s*from_unixtime\((\d+)\)$`)
)

// ParseSQLCondition 将 SQL where 条件解析为 RowColumnCondCfg 结构体
// 支持的operation：
// - 逻辑组合：and、or
// - 比较：==、!=、>、>=、<、<=
// - 集合：in、not_in
// - 模糊/匹配：like、not_like、contain、not_contain、regex、match、match_phrase、prefix、not_prefix
// - 区间/时间：range、out_range、between、before、current
// - 判空/存在/布尔：exist、not_exist、empty、not_empty、null、not_null、true、false

// 示例：create_time > '2026-05-13 00:00:00' and create_time < '2026-05-13 23:59:59'
//
// 解析为：
//
//	&data_model.RowColumnCondCfg{
//		Field: "create_time",
//		Operation: "between",
//		ValueFrom: "const",
//		Value: []any{"2026-05-13 00:00:00", "2026-05-13 23:59:59"},
//	}
func ParseSQLCondition(whereSQL string) (*data_model.RowColumnCondCfg, error) {
	whereSQL = strings.TrimSpace(whereSQL)
	if whereSQL == "" {
		return nil, nil
	}

	return parseExpr(whereSQL)
}

func parseExpr(expr string) (*data_model.RowColumnCondCfg, error) {
	expr = trimOuterParens(strings.TrimSpace(expr))
	if expr == "" {
		return nil, nil
	}

	if cfg, ok, err := parseSpecialComposite(expr); ok || err != nil {
		return cfg, err
	}

	if parts := splitTopLevelByKeyword(expr, "or"); len(parts) > 1 {
		sub, err := parseSubConditions(parts)
		if err != nil {
			return nil, err
		}
		return &data_model.RowColumnCondCfg{
			Operation:     "or",
			SubConditions: sub,
		}, nil
	}

	if parts := splitTopLevelByKeyword(expr, "and"); len(parts) > 1 {
		sub, err := parseSubConditions(parts)
		if err != nil {
			return nil, err
		}
		return &data_model.RowColumnCondCfg{
			Operation:     "and",
			SubConditions: sub,
		}, nil
	}

	return parsePredicate(expr)
}

func parseSubConditions(parts []string) ([]*data_model.RowColumnCondCfg, error) {
	sub := make([]*data_model.RowColumnCondCfg, 0, len(parts))
	for _, p := range parts {
		c, err := parseExpr(p)
		if err != nil {
			return nil, err
		}
		if c != nil {
			sub = append(sub, c)
		}
	}
	return sub, nil
}

func parseSpecialComposite(expr string) (*data_model.RowColumnCondCfg, bool, error) {
	// contain/not_contain 在 SQL 里若右值是数组，会被展开成多个 AND 条件，反解时聚合回单个条件。
	if parts := splitTopLevelByKeyword(expr, "and"); len(parts) > 1 {
		if cfg, ok, err := mergeJSONContainsByAnd(parts, false); ok || err != nil {
			return cfg, true, err
		}
		if cfg, ok, err := mergeJSONContainsByAnd(parts, true); ok || err != nil {
			return cfg, true, err
		}
	}

	if m := reBetweenQuotedDatetime.FindStringSubmatch(expr); len(m) == 4 {
		return newLeafWithValue(m[1], "between", []any{m[2], m[3]}), true, nil
	}
	if m := reBetween.FindStringSubmatch(expr); len(m) == 4 {
		v1, err := parseValue(m[2])
		if err != nil {
			return nil, true, err
		}
		v2, err := parseValue(m[3])
		if err != nil {
			return nil, true, err
		}
		return newLeafWithValue(m[1], "between", []any{v1, v2}), true, nil
	}
	if m := reNotEmpty.FindStringSubmatch(expr); len(m) == 3 && m[1] == m[2] {
		return &data_model.RowColumnCondCfg{Field: m[1], Operation: "not_empty"}, true, nil
	}
	if m := reEmpty.FindStringSubmatch(expr); len(m) == 3 && m[1] == m[2] {
		return &data_model.RowColumnCondCfg{Field: m[1], Operation: "empty"}, true, nil
	}
	if m := reOutRange.FindStringSubmatch(expr); len(m) == 5 && m[1] == m[3] {
		lv, err := parseValue(m[2])
		if err != nil {
			return nil, true, err
		}
		rv, err := parseValue(m[4])
		if err != nil {
			return nil, true, err
		}
		return newLeafWithValue(m[1], "out_range", []any{lv, rv}), true, nil
	}
	if m := reBefore.FindStringSubmatch(expr); len(m) == 5 && m[1] == m[4] {
		v, err := parseValue(m[3])
		if err != nil {
			return nil, true, err
		}
		return newLeafWithValue(m[1], "before", v), true, nil
	}
	// current 在 SQL 中会被展平为 from_unixtime 区间，这里按 range 反解，保留语义。
	if m := reCurrentAsRange.FindStringSubmatch(expr); len(m) == 5 && m[1] == m[3] {
		startV, _ := strconv.ParseInt(m[2], 10, 64)
		endV, _ := strconv.ParseInt(m[4], 10, 64)
		return newLeafWithValue(m[1], "range", []any{startV, endV}), true, nil
	}
	if m := reRange.FindStringSubmatch(expr); len(m) == 5 && m[1] == m[3] {
		lv, err := parseValue(m[2])
		if err != nil {
			return nil, true, err
		}
		rv, err := parseValue(m[4])
		if err != nil {
			return nil, true, err
		}
		return newLeafWithValue(m[1], "range", []any{lv, rv}), true, nil
	}
	return nil, false, nil
}

func mergeJSONContainsByAnd(parts []string, not bool) (*data_model.RowColumnCondCfg, bool, error) {
	field := ""
	values := make([]any, 0, len(parts))

	for _, p := range parts {
		var m []string
		if not {
			m = reNotJSONContains.FindStringSubmatch(trimOuterParens(strings.TrimSpace(p)))
		} else {
			m = reJSONContains.FindStringSubmatch(trimOuterParens(strings.TrimSpace(p)))
		}
		if len(m) != 3 {
			return nil, false, nil
		}
		if field == "" {
			field = m[1]
		} else if field != m[1] {
			return nil, false, nil
		}

		v, err := parseValue(m[2])
		if err != nil {
			return nil, true, err
		}
		values = append(values, v)
	}

	op := "contain"
	if not {
		op = "not_contain"
	}
	return newLeafWithValue(field, op, values), true, nil
}

func parsePredicate(expr string) (*data_model.RowColumnCondCfg, error) {
	if m := reFieldIsNotNull.FindStringSubmatch(expr); len(m) == 2 {
		return &data_model.RowColumnCondCfg{Field: m[1], Operation: "not_null"}, nil
	}
	if m := reFieldIsNull.FindStringSubmatch(expr); len(m) == 2 {
		return &data_model.RowColumnCondCfg{Field: m[1], Operation: "null"}, nil
	}
	if m := reFieldBool.FindStringSubmatch(expr); len(m) == 3 {
		if strings.EqualFold(m[2], "true") {
			return &data_model.RowColumnCondCfg{Field: m[1], Operation: "true"}, nil
		}
		return &data_model.RowColumnCondCfg{Field: m[1], Operation: "false"}, nil
	}
	if m := reRegexLike.FindStringSubmatch(expr); len(m) == 3 {
		return newLeafWithValue(m[1], "regex", unescapeSQLString(m[2])), nil
	}
	if m := reNotJSONContains.FindStringSubmatch(expr); len(m) == 3 {
		v, err := parseValue(m[2])
		if err != nil {
			return nil, err
		}
		return newLeafWithValue(m[1], "not_contain", v), nil
	}
	if m := reJSONContains.FindStringSubmatch(expr); len(m) == 3 {
		v, err := parseValue(m[2])
		if err != nil {
			return nil, err
		}
		return newLeafWithValue(m[1], "contain", v), nil
	}
	if m := reNotIn.FindStringSubmatch(expr); len(m) == 3 {
		values, err := parseList(m[2])
		if err != nil {
			return nil, err
		}
		return newLeafWithValue(m[1], "not_in", values), nil
	}
	if m := reIn.FindStringSubmatch(expr); len(m) == 3 {
		values, err := parseList(m[2])
		if err != nil {
			return nil, err
		}
		return newLeafWithValue(m[1], "in", values), nil
	}
	if m := reNotLike.FindStringSubmatch(expr); len(m) == 3 {
		val := unescapeSQLString(m[2])
		if strings.HasSuffix(val, "%") && !strings.HasPrefix(val, "%") {
			return newLeafWithValue(m[1], "not_prefix", strings.TrimSuffix(val, "%")), nil
		}
		return newLeafWithValue(m[1], "not_like", val), nil
	}
	if m := reLike.FindStringSubmatch(expr); len(m) == 3 {
		val := unescapeSQLString(m[2])
		if strings.HasSuffix(val, "%") && !strings.HasPrefix(val, "%") {
			return newLeafWithValue(m[1], "prefix", strings.TrimSuffix(val, "%")), nil
		}
		return newLeafWithValue(m[1], "like", val), nil
	}
	if m := reCompare.FindStringSubmatch(expr); len(m) == 4 {
		op := map[string]string{
			"=":  "==",
			"<>": "!=",
			">":  ">",
			">=": ">=",
			"<":  "<",
			"<=": "<=",
		}[m[2]]
		if op == "" {
			return nil, fmt.Errorf("unsupported comparison operator: %s", m[2])
		}
		v, err := parseValue(m[3])
		if err != nil {
			return nil, err
		}
		return newLeafWithValue(m[1], op, v), nil
	}

	return nil, fmt.Errorf("unsupported SQL condition: %s", expr)
}

func newLeafWithValue(field, operation string, value any) *data_model.RowColumnCondCfg {
	return &data_model.RowColumnCondCfg{
		Field:     field,
		Operation: operation,
		ValueFrom: valueFromConst,
		Value:     value,
	}
}

func parseList(raw string) ([]any, error) {
	items := splitTopLevelByComma(raw)
	values := make([]any, 0, len(items))
	for _, item := range items {
		v, err := parseValue(item)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, nil
}

func parseValue(raw string) (any, error) {
	raw = strings.TrimSpace(raw)
	raw = trimOuterParens(raw)
	if raw == "" {
		return "", nil
	}

	if strings.HasPrefix(raw, "'") && strings.HasSuffix(raw, "'") && len(raw) >= 2 {
		return unescapeSQLString(raw[1 : len(raw)-1]), nil
	}
	if strings.EqualFold(raw, "true") {
		return true, nil
	}
	if strings.EqualFold(raw, "false") {
		return false, nil
	}
	if i, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return i, nil
	}
	if f, err := strconv.ParseFloat(raw, 64); err == nil {
		return f, nil
	}
	// 对于 DATE_TRUNC / CAST / from_unixtime 等复杂表达式，保留原串。
	return raw, nil
}

func splitTopLevelByComma(expr string) []string {
	parts := make([]string, 0)
	start := 0
	depth := 0
	inQuote := false
	for i := 0; i < len(expr); i++ {
		ch := expr[i]
		if ch == '\'' {
			if inQuote && i+1 < len(expr) && expr[i+1] == '\'' {
				i++
				continue
			}
			inQuote = !inQuote
			continue
		}
		if inQuote {
			continue
		}
		switch ch {
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		case ',':
			if depth == 0 {
				parts = append(parts, strings.TrimSpace(expr[start:i]))
				start = i + 1
			}
		}
	}
	parts = append(parts, strings.TrimSpace(expr[start:]))
	return filterNonEmpty(parts)
}

func splitTopLevelByKeyword(expr, keyword string) []string {
	parts := make([]string, 0)
	start := 0
	depth := 0
	inQuote := false
	kw := strings.ToLower(keyword)
	lower := strings.ToLower(expr)

	for i := 0; i < len(expr); i++ {
		ch := expr[i]
		if ch == '\'' {
			if inQuote && i+1 < len(expr) && expr[i+1] == '\'' {
				i++
				continue
			}
			inQuote = !inQuote
			continue
		}
		if inQuote {
			continue
		}
		if ch == '(' {
			depth++
			continue
		}
		if ch == ')' {
			if depth > 0 {
				depth--
			}
			continue
		}
		if depth != 0 {
			continue
		}
		if i+len(kw) <= len(expr) && lower[i:i+len(kw)] == kw {
			prevOK := i == 0 || isBoundary(expr[i-1])
			nextOK := i+len(kw) == len(expr) || isBoundary(expr[i+len(kw)])
			if prevOK && nextOK {
				parts = append(parts, strings.TrimSpace(expr[start:i]))
				start = i + len(kw)
				i += len(kw) - 1
			}
		}
	}
	parts = append(parts, strings.TrimSpace(expr[start:]))
	return filterNonEmpty(parts)
}

func trimOuterParens(s string) string {
	s = strings.TrimSpace(s)
	for len(s) >= 2 && s[0] == '(' && s[len(s)-1] == ')' {
		if !isWrappedByOuterParens(s) {
			break
		}
		s = strings.TrimSpace(s[1 : len(s)-1])
	}
	return s
}

func isWrappedByOuterParens(s string) bool {
	depth := 0
	inQuote := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch == '\'' {
			if inQuote && i+1 < len(s) && s[i+1] == '\'' {
				i++
				continue
			}
			inQuote = !inQuote
			continue
		}
		if inQuote {
			continue
		}
		if ch == '(' {
			depth++
		} else if ch == ')' {
			depth--
			if depth == 0 && i != len(s)-1 {
				return false
			}
		}
	}
	return depth == 0
}

func isBoundary(ch byte) bool {
	switch {
	case ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r':
		return true
	case ch == '(' || ch == ')' || ch == ',':
		return true
	default:
		return false
	}
}

func unescapeSQLString(s string) string {
	s = strings.ReplaceAll(s, "''", "'")
	s = strings.ReplaceAll(s, `\\`, `\`)
	return s
}

func filterNonEmpty(parts []string) []string {
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
