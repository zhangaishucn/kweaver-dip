package impl

import (
	"context"
	"strings"
	"time"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/automation"
	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	domain "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/data_auth"
)

const AuditType = "data-view-auth-audit"

type useCase struct {
	dataModel        data_model.Driven
	automationDriven automation.Driven
}

func NewDataAuth(
	dataModel data_model.Driven,
	automationDriven automation.Driven,
) domain.UseCase {
	return &useCase{
		dataModel:        dataModel,
		automationDriven: automationDriven,
	}
}

func (u *useCase) DataResourceAuth(ctx context.Context, req *dto.DataResourceAuthReqArg) error {
	//1. 检查申请资源是否存在, 补充资源信息
	resources, err := u.dataModel.GetDataModelByIDInternal(ctx, req.ResourceID...)
	if err != nil {
		return err
	}
	//2. 检查授权操作是否存在, 不存在则默认查询和查看
	if len(req.AuthOperations) <= 0 {
		req.AuthOperations = []string{authorization.VIEW_OPERATION_DATA_QUERY, authorization.VIEW_OPERATION_VIEW_DETAIL}
	}
	//3. 获取审核流程元数据ID和表单数据
	dagMetaID, formData, err := u.getRunInstanceForm(ctx)
	if err != nil {
		return err
	}
	for _, resource := range resources {
		expiration := "永不过期"
		if req.ExpiredAt > time.Now().Unix() {
			expiration = time.Unix(req.ExpiredAt, 0).Format(time.DateTime)
		}
		//调用运行流程
		payload := map[string]any{
			"data_view_id":    resource.Id,
			"data_view_name":  resource.Name,
			"datasource_name": resource.DataSourceName,
			"applicant_type":  req.ApplicantType,
			"applicant_id":    req.ApplicantID,
			"applicant_name":  req.ApplicantName,
			"operations":      strings.Join(req.AuthOperations, ","),
			"operations_name": strings.Join(authorization.GetViewOperationDisplay(req.AuthOperations), ","),
			"expiration":      expiration,
		}
		//参数置换
		args := make(map[string]any)
		for key, value := range formData {
			args[value] = payload[key]
		}
		if err = u.automationDriven.RunInstanceForm(ctx, dagMetaID, args); err != nil {
			return err
		}
	}
	return nil
}

func (u *useCase) getRunInstanceForm(ctx context.Context) (string, map[string]string, error) {
	//查询流程元数据详情
	dagMeta, err := u.automationDriven.DagByName(ctx, AuditType)
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
