package impl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	gutil "github.com/kweaver-ai/idrm-go-common/util"
	"github.com/kweaver-ai/idrm-go-frame/core/enum"
	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	"github.com/samber/lo"
)

const adminUserName = "admin"

func manageOperationForResourceType(resourceType string) string {
	switch resourceType {
	case authorization.KNOWLEDGE_NETWORK_RESOURCE_NAME:
		return authorization.KNOperationEnumAuthorize.String
	case authorization.SUB_VIEW_RESOURCE_NAME:
		return authorization.ViewOperationEnumRuleAuthorize.String
	default:
		return authorization.ViewOperationEnumAuthorize.String
	}
}

func resourceTypeForManageCheck(resourceType string) string {
	if resourceType == authorization.SUB_VIEW_RESOURCE_NAME {
		return authorization.DATA_VIEW_RESOURCE_NAME
	}
	return resourceType
}

// canDirectGrant 判断当前用户是否可跳过审核直接授权：admin 用户、内置业务角色、或对全部资源具备管理权限。
func (u *useCase) canDirectGrant(ctx context.Context, req *dto.DataResourceAuthReqArg) (bool, error) {
	userInfo, err := gutil.GetUserInfo(ctx)
	if err != nil {
		return false, err
	}
	if userInfo.Name == adminUserName {
		return true, nil
	}
	hasInnerRole, err := u.auth.HasRoles(ctx, userInfo.ID, authorization.InnerBusinessRoles...)
	if err != nil {
		return false, err
	}
	if hasInnerRole {
		return true, nil
	}
	manageOp := manageOperationForResourceType(req.ResourceType)
	resourceType := resourceTypeForManageCheck(req.ResourceType)
	resources := lo.Map(req.ResourceID, func(id string, _ int) authorization.ResourceObject {
		return authorization.ResourceObject{
			ID:   id,
			Type: resourceType,
		}
	})
	result, err := u.auth.ResourceFilter(ctx, &authorization.ResourceFilterArgs{
		AllowOperation: true,
		Accessor: authorization.Accessor{
			ID:   userInfo.ID,
			Type: authorization.ACCESSOR_TYPE_USER,
		},
		Resources: resources,
		Operation: []string{manageOp},
		Method:    "GET",
	})
	if err != nil {
		return false, err
	}
	if len(result) != len(req.ResourceID) {
		return false, nil
	}
	for i, r := range result {
		if r.Id != req.ResourceID[i] || !lo.Every(r.AllowOperation, []string{manageOp}) {
			return false, nil
		}
	}
	return true, nil
}

func (u *useCase) grantDirectly(ctx context.Context, handler AuthHandler, resources []map[string]any, req *dto.DataResourceAuthReqArg) error {
	for i, resource := range resources {
		payload, err := handler.GenAuditContent(i, resource, req)
		if err != nil {
			return errorcode.AuditContentGenerationFailedErr.Detail(err.Error())
		}
		auditDataStr, ok := payload["audit_data"].(string)
		if !ok || auditDataStr == "" {
			return errorcode.AuditContentGenerationFailedErr.Detail("audit_data missing")
		}
		auditContent := make(map[string]any)
		if err := json.Unmarshal([]byte(auditDataStr), &auditContent); err != nil {
			return errorcode.PublicInvalidParameterJsonErr.Desc()
		}
		if err := handler.GrantPolicyAfterApproval(ctx, auditContent); err != nil {
			return err
		}
	}
	return nil
}

// addAuditOperation 添加权限，这段的代码逻辑是一样的，所以抽成一个函数
func addAuditOperation(ctx context.Context, auth authorization.Driven, body map[string]any) error {
	dataID := strFromBody(body, "data_id")
	dataName := strFromBody(body, "data_name")
	dataType := strFromBody(body, "data_type")
	applicantID := strFromBody(body, "applicant_id")
	applicantType := strFromBody(body, "applicant_type")
	operations := parseStringListFromBody(body, "operations")
	expiresAt := parseExpirationRFC3339(strFromBody(body, "expiration"))
	if dataName == "" {
		dataName = dataID
	}

	if dataID == "" || applicantID == "" || applicantType == "" || len(operations) == 0 {
		log.Errorf("data auth approval: missing required fields in body, data_id=%q applicant_id=%q ops=%v", dataID, applicantID, operations)
		return errorcode.PublicInvalidParameterJsonErr.Desc()
	}

	args := []*authorization.CreatePolicyReq{
		{
			Accessor: authorization.Accessor{
				ID:   applicantID,
				Type: applicantType,
			},
			Resource: authorization.ResourceObject{
				ID:   dataID,
				Type: dataType,
				Name: dataName,
			},
			Operation: authorization.AuthOperation{
				Allow: lo.Map(operations, func(op string, _ int) *authorization.OperationObject {
					return &authorization.OperationObject{ID: op}
				}),
				Deny: []*authorization.OperationObject{},
			},
			ExpiresAt: expiresAt,
		},
	}
	if _, err := auth.CreatePolicy(ctx, args); err != nil {
		log.Errorf("data auth approval CreatePolicy: %v", err)
		return err
	}
	return nil
}

func (u *useCase) getRunInstanceForm(ctx context.Context) (string, map[string]string, error) {
	//查询流程元数据详情
	dagMeta, err := u.automationDriven.SharedDagByName(ctx, DATA_RESOURCE_AUDIT_TYPE)
	if err != nil {
		return "", nil, errorcode.AuditProcessNotExistErr.Detail(err.Error())
	}
	//查询流程的步骤，获取表单数据
	dagDetail, err := u.automationDriven.DagDetail(ctx, dagMeta.ID)
	if err != nil {
		return "", nil, errorcode.AuditProcessNotExistErr.Detail(err.Error())
	}
	result := make(map[string]string)
	if len(dagDetail.Steps) <= 0 {
		return "", nil, errorcode.AuditProcessNotExistErr.Detail("audit process steps not exist")
	}
	step := dagDetail.Steps[0]
	for _, field := range step.Parameters.Fields {
		result[field.Name] = field.Key
	}
	return dagMeta.ID, result, nil
}

func getApplicantTypeName(applicantType string) string {
	display := enum.GetObj[authorization.AccessorTypeEnum](applicantType).Display
	if display == "" {
		return applicantType
	}
	return display
}

func getResourceTypeName(resourceType string) string {
	display := enum.GetObj[authorization.ResourceTypeEnum](resourceType).Display
	if display == "" {
		return resourceType
	}
	return display
}

func strFromBody(body map[string]any, keys ...string) string {
	for _, key := range keys {
		v, ok := body[key]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case string:
			if strings.TrimSpace(t) != "" {
				return strings.TrimSpace(t)
			}
		case float64:
			if t == float64(int64(t)) {
				return fmt.Sprintf("%.0f", t)
			}
			return fmt.Sprintf("%g", t)
		case bool:
			if t {
				return "true"
			}
			return "false"
		}
	}
	return ""
}

func parseStringListFromBody(body map[string]any, key string) []string {
	raw, ok := body[key]
	if !ok || raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case string:
		return splitOpList(v)
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			switch s := item.(type) {
			case string:
				if op := strings.TrimSpace(s); op != "" {
					out = append(out, op)
				}
			}
		}
		return out
	default:
		return nil
	}
}

func splitOpList(s string) []string {
	parts := strings.Split(s, ",")
	return lo.FilterMap(parts, func(p string, _ int) (string, bool) {
		op := strings.TrimSpace(p)
		return op, op != ""
	})
}

// 与审核流脚本约定一致：永不过期用东八区 1970 起点；否则按本地时间解析 "2006-01-02 15:04:05"。
func parseExpirationRFC3339(expiration string) string {
	if expiration == "" || expiration == "永不过期" {
		t := time.Date(1970, 1, 1, 8, 0, 0, 0, time.FixedZone("CST", 8*3600))
		return t.Format(time.RFC3339)
	}
	loc := time.FixedZone("CST", 8*3600)
	t, err := time.ParseInLocation("2006-01-02 15:04:05", expiration, loc)
	if err != nil {
		log.Warnf("parse expiration %q: %v, fallback to permanent", expiration, err)
		t = time.Date(1970, 1, 1, 8, 0, 0, 0, loc)
	}
	return t.Format(time.RFC3339)
}

func loadSubViewRules(body map[string]any) (*dto.SubViewRules, error) {
	columnRules := strFromBody(body, "column_rules")
	rowRules := strFromBody(body, "row_rules")
	return &dto.SubViewRules{
		ColumnRules: columnRules,
		RowRules:    rowRules,
	}, nil
}

func toJsonStr(body map[string]any) string {
	return string(lo.T2(json.Marshal(body)).A)
}

func parseResourceAttributesToDict(resourceAttributes any) (map[string]any, error) {
	if resourceAttributes == nil {
		return nil, errors.New("resource attributes is nil")
	}
	payload, err := json.Marshal(resourceAttributes)
	if err != nil {
		return nil, err
	}
	resourceAttributesDict := make(map[string]any)
	err = json.Unmarshal(payload, &resourceAttributesDict)
	if err != nil {
		return nil, err
	}
	return resourceAttributesDict, nil
}
