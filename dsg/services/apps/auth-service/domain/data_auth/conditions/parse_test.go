package conditions

import (
	"reflect"
	"testing"

	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
)

func leaf(field, op string, val any) *data_model.RowColumnCondCfg {
	return &data_model.RowColumnCondCfg{
		Field:     field,
		Operation: op,
		ValueFrom: "const",
		Value:     val,
	}
}

func TestParseSQLCondition(t *testing.T) {
	tests := []struct {
		name    string
		sql     string
		want    *data_model.RowColumnCondCfg
		wantErr bool
	}{
		{
			name: "compare and nested logic",
			sql:  `"a" = 1 AND ("b" LIKE 'abc%' OR "c" IS NULL)`,
			want: &data_model.RowColumnCondCfg{
				Operation: "and",
				SubConditions: []*data_model.RowColumnCondCfg{
					leaf("a", "==", int64(1)),
					{
						Operation: "or",
						SubConditions: []*data_model.RowColumnCondCfg{
							leaf("b", "prefix", "abc"),
							{Field: "c", Operation: "null"},
						},
					},
				},
			},
		},
		{
			name: "in and not in",
			sql:  `"status" IN ('ok','fail') OR "id" NOT IN (1,2,3)`,
			want: &data_model.RowColumnCondCfg{
				Operation: "or",
				SubConditions: []*data_model.RowColumnCondCfg{
					leaf("status", "in", []any{"ok", "fail"}),
					leaf("id", "not_in", []any{int64(1), int64(2), int64(3)}),
				},
			},
		},
		{
			name: "empty and not empty",
			sql:  `"x" IS NULL OR "x" = ''`,
			want: &data_model.RowColumnCondCfg{
				Field:     "x",
				Operation: "empty",
			},
		},
		{
			name: "range",
			sql:  `"score" >= 60 AND "score" < 100`,
			want: leaf("score", "range", []any{int64(60), int64(100)}),
		},
		{
			name: "out range",
			sql:  `("age" < 18 OR "age" >= 60)`,
			want: leaf("age", "out_range", []any{int64(18), int64(60)}),
		},
		{
			name: "between datetime trunc",
			sql:  `"create_time" BETWEEN DATE_TRUNC('minute', CAST('2026-05-13 00:00:00' AS TIMESTAMP)) AND DATE_TRUNC('minute', CAST('2026-05-13 23:59:59' AS TIMESTAMP))`,
			want: leaf("create_time", "between", []any{"2026-05-13 00:00:00", "2026-05-13 23:59:59"}),
		},
		{
			name: "regex and bool",
			sql:  `REGEXP_LIKE("name", '^ab.*') AND "enabled" = true`,
			want: &data_model.RowColumnCondCfg{
				Operation: "and",
				SubConditions: []*data_model.RowColumnCondCfg{
					leaf("name", "regex", "^ab.*"),
					{Field: "enabled", Operation: "true"},
				},
			},
		},
		{
			name: "before",
			sql:  `"ts" >= DATE_add('day', -7, CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AND "ts" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'`,
			want: leaf("ts", "before", int64(7)),
		},
		{
			name: "contain single value",
			sql:  `json_array_contains("tags", 'prod')`,
			want: leaf("tags", "contain", "prod"),
		},
		{
			name: "contain slice value merged by and",
			sql:  `json_array_contains("tags", 'prod') AND json_array_contains("tags", 'stable')`,
			want: leaf("tags", "contain", []any{"prod", "stable"}),
		},
		{
			name: "not contain slice value merged by and",
			sql:  `NOT json_array_contains("tags", 'test') AND NOT json_array_contains("tags", 'deprecated')`,
			want: leaf("tags", "not_contain", []any{"test", "deprecated"}),
		},
		{
			name: "not null from exist sql",
			sql:  `"owner" IS NOT NULL`,
			want: &data_model.RowColumnCondCfg{
				Field:     "owner",
				Operation: "not_null",
			},
		},
		{
			name: "not like plain pattern",
			sql:  `"name" NOT LIKE '%tmp%'`,
			want: leaf("name", "not_like", "%tmp%"),
		},
		{
			name:    "unsupported sql",
			sql:     `foo(bar)`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseSQLCondition(tt.sql)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("parse result mismatch\nsql: %s\ngot: %#v\nwant: %#v", tt.sql, got, tt.want)
			}
		})
	}
}

