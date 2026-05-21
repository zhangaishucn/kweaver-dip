package impl

import (
	"context"
	"strings"
	"time"

	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
)

type dataViewHandler struct {
	dataModel    data_model.Driven
	auth         authorization.Driven
	resourceType string
}

func (u *useCase) newDataViewAuthHandler() *dataViewHandler {
	return &dataViewHandler{
		dataModel:    u.dataModel,
		auth:         u.auth,
		resourceType: authorization.DATA_VIEW_RESOURCE_NAME,
	}
}

func (h *dataViewHandler) ValidateParams(ctx context.Context, req *dto.DataResourceAuthReqArg) error {
	return nil
}

func (h *dataViewHandler) QueryDataSources(ctx context.Context, ids ...string) ([]map[string]any, error) {
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
		})
	}
	return dataViewModels, nil
}

func (h *dataViewHandler) genOperationNames(operations []string) string {
	return authorization.JoinDisplay[authorization.ViewOperationEnum](operations)
}

func (h *dataViewHandler) GenAuditContent(index int, resource map[string]any, req *dto.DataResourceAuthReqArg) (map[string]any, error) {
	expiration := "永不过期"
	if req.ExpiredAt > time.Now().Unix() {
		expiration = time.Unix(req.ExpiredAt, 0).Format(time.DateTime)
	}

	displayData := map[string]any{
		"applicant_name":     req.ApplicantName,
		"applicant_cn_type":  getApplicantTypeName(req.ApplicantType),
		"datasource_name":    resource["datasource_name"],
		"data_view_name":     resource["name"],
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
	}
	// 返回结果，包含资源类型、显示数据、审核内容
	result := map[string]any{
		"data_type":    req.ResourceType,
		"display_data": toJsonStr(displayData),
		"audit_data":   toJsonStr(auditContent),
	}
	log.Infof("display_data: %v", result["display_data"])
	return result, nil
}

func (h *dataViewHandler) GrantPolicyAfterApproval(ctx context.Context, body map[string]any) error {
	return addAuditOperation(ctx, h.auth, body)
}
