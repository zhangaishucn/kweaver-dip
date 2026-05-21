package impl

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/data_auth/conditions"
	"github.com/samber/lo"
)

/*
申请字段的行列规则，比如：
审核的时候显示所有字段的技术名称，业务名称，申请的列，申请的行
*/

type subViewHandler struct {
	dataModel    data_model.Driven
	auth         authorization.Driven
	resourceType string
}

func (u *useCase) newSubViewAuthHandler() *subViewHandler {
	return &subViewHandler{
		dataModel:    u.dataModel,
		auth:         u.auth,
		resourceType: authorization.SUB_VIEW_RESOURCE_NAME,
	}
}

// QueryDataSources 查询视图的详情和字段
// 视图行列规则时候，是字段名列表
func (h *subViewHandler) QueryDataSources(ctx context.Context, ids ...string) ([]map[string]any, error) {
	dataViews, err := h.dataModel.GetDataModelByIDInternal(ctx, ids...)
	if err != nil {
		return nil, err
	}
	dataViewModels := make([]map[string]any, 0)
	for _, dataView := range dataViews {
		dataViewModels = append(dataViewModels, map[string]any{
			"id":              dataView.Id,
			"name":            dataView.Name,
			"datasource_name": dataView.DataSourceName,
			"all_technical_columns": lo.Map(dataView.Fields, func(field data_model.Field, _ int) string {
				return field.Name
			}),
			"all_business_columns": lo.Map(dataView.Fields, func(field data_model.Field, _ int) string {
				return field.DisplayName
			}),
		})
	}
	return dataViewModels, nil
}

func (h *subViewHandler) ValidateParams(ctx context.Context, req *dto.DataResourceAuthReqArg) error {
	// 普通数据视图申请（未携带行列规则）直接放过。
	if len(req.ResourceAttributes) == 0 {
		return nil
	}

	for i, attr := range req.ResourceAttributes {
		rules, err := decodeSubViewRules(attr)
		if err != nil {
			return errorcode.PublicInvalidParameterJsonErr.Detail(fmt.Sprintf("resource_attributes[%d] invalid: %v", i, err))
		}
		if _, err = parseRowRules(rules.RowRules); err != nil {
			return errorcode.PublicInvalidParameterErr.Detail(fmt.Sprintf("resource_attributes[%d].row_rules invalid: %v", i, err))
		}
	}

	return nil
}

func (h *subViewHandler) GenAuditContent(index int, resource map[string]any, req *dto.DataResourceAuthReqArg) (map[string]any, error) {
	expiration := "永不过期"
	if req.ExpiredAt > time.Now().Unix() {
		expiration = time.Unix(req.ExpiredAt, 0).Format(time.DateTime)
	}

	resourceAttributesDict, err := parseResourceAttributesToDict(req.ResourceAttributes[index])
	if err != nil {
		return nil, err
	}

	displayData := map[string]any{
		"applicant_name":     req.ApplicantName,
		"applicant_cn_type":  getApplicantTypeName(req.ApplicantType),
		"datasource_name":    resource["datasource_name"],
		"data_view_name":     resource["name"],
		"column_rules":       resourceAttributesDict["column_rules"],
		"row_rules":          resourceAttributesDict["row_rules"],
		"operations_cn_name": h.genOperationNames(req.AuthOperations),
		"expiration":         expiration,
	}
	auditContent := map[string]any{
		"data_id":        resource["id"],
		"data_name":      resource["name"],
		"data_type":      req.ResourceType,
		"applicant_id":   req.ApplicantID,
		"applicant_type": req.ApplicantType,
		"operations":     strings.Join(req.AuthOperations, ","),
		"expiration":     expiration,
		"column_rules":   resourceAttributesDict["column_rules"],
		"row_rules":      resourceAttributesDict["row_rules"],
	}
	return map[string]any{
		"data_type":    req.ResourceType,
		"display_data": toJsonStr(displayData),
		"audit_data":   toJsonStr(auditContent),
	}, nil
}

func (h *subViewHandler) GrantPolicyAfterApproval(ctx context.Context, body map[string]any) error {
	//修改行列规则名称
	dataName := strFromBody(body, "data_name")
	body["data_name"] = fmt.Sprintf("%s行列规则-%v", dataName, time.Now().Unix())
	subViewRulesID, err := h.addSubViewRules(ctx, body)
	if err != nil {
		return err
	}
	//修改行列规则ID
	body["data_id"] = subViewRulesID
	return addAuditOperation(ctx, h.auth, body)
}

func (h *subViewHandler) addSubViewRules(ctx context.Context, body map[string]any) (string, error) {
	dataID := strFromBody(body, "data_id")
	dataName := strFromBody(body, "data_name")
	subViewRules, err := loadSubViewRules(body)
	if err != nil {
		return "", err
	}
	subViewRulesConfig, err := parseRowRules(subViewRules.RowRules)
	if err != nil {
		return "", err
	}
	subViewRulesWrite := &data_model.DataViewRowColumnRuleWrite{
		Name:       dataName,
		ViewID:     dataID,
		Tags:       []string{},
		Fields:     strings.Split(subViewRules.ColumnRules, ","),
		RowFilters: subViewRulesConfig,
	}
	//创建行列规则
	ids, err := h.dataModel.CreateDataViewRowColumnRulesInternal(ctx, []data_model.DataViewRowColumnRuleWrite{*subViewRulesWrite})
	if err != nil {
		return "", err
	}
	return ids[0], nil
}

func (h *subViewHandler) genOperationNames(operations []string) string {
	return authorization.JoinDisplay[authorization.SubViewOperationEnum](operations)
}

func decodeSubViewRules(attr any) (*dto.SubViewRules, error) {
	payload, err := json.Marshal(attr)
	if err != nil {
		return nil, err
	}
	rules := &dto.SubViewRules{}
	if err = json.Unmarshal(payload, rules); err != nil {
		return nil, err
	}
	return rules, nil
}

func parseRowRules(content string) (*data_model.RowColumnCondCfg, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, nil
	}

	// 兼容已有 JSON 条件树输入。
	cfg := &data_model.RowColumnCondCfg{}
	if err := json.Unmarshal([]byte(content), cfg); err == nil {
		return cfg, nil
	}

	// 新增兼容 SQL where 条件输入。
	return conditions.ParseSQLCondition(content)
}
