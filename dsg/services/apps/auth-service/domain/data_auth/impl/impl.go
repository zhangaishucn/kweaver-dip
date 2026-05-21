package impl

import (
	"context"
	"encoding/json"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/automation"
	"github.com/kweaver-ai/idrm-go-common/rest/bkn_backend"
	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
	"github.com/kweaver-ai/idrm-go-common/rest/dip_studio"
	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	domain "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/data_auth"
)

const (
	DATA_RESOURCE_AUDIT_TYPE = "data-resource-auth-audit" //数据资源审核流
)

type AuthHandler interface {
	ValidateParams(ctx context.Context, req *dto.DataResourceAuthReqArg) error
	QueryDataSources(ctx context.Context, ids ...string) ([]map[string]any, error)
	GenAuditContent(index int, resource map[string]any, req *dto.DataResourceAuthReqArg) (map[string]any, error)
	GrantPolicyAfterApproval(ctx context.Context, body map[string]any) error
}

type useCase struct {
	dataModel        data_model.Driven
	automationDriven automation.Driven
	bknBackend       bkn_backend.Driven
	auth             authorization.Driven
	dipStudio        dip_studio.Driven
}

func NewDataAuth(
	dataModel data_model.Driven,
	automationDriven automation.Driven,
	bknBackend bkn_backend.Driven,
	auth authorization.Driven,
	dipStudio dip_studio.Driven,
) domain.UseCase {
	return &useCase{
		dataModel:        dataModel,
		automationDriven: automationDriven,
		bknBackend:       bknBackend,
		auth:             auth,
		dipStudio:        dipStudio,
	}
}

func (u *useCase) newAuthHandler(req *dto.DataResourceAuthReqArg) AuthHandler {
	//如果是数据视图，且带字段的，则转换为行列规则
	resourceType := req.ResourceType
	if resourceType == authorization.DATA_VIEW_RESOURCE_NAME && len(req.ResourceAttributes) > 0 {
		resourceType = authorization.SUB_VIEW_RESOURCE_NAME
		req.AuthOperations = []string{authorization.SubViewOperationEnumRuleApply.String}
	}
	log.Infof("new auth handler for resource type: %s", resourceType)
	switch resourceType {
	case authorization.DATA_VIEW_RESOURCE_NAME:
		return u.newDataViewAuthHandler()
	case authorization.KNOWLEDGE_NETWORK_RESOURCE_NAME:
		return u.newKnowledgeNetworkAuthHandler()
	case authorization.SUB_VIEW_RESOURCE_NAME:
		return u.newSubViewAuthHandler()
	default:
		return nil
	}
}

// DataResourceAuth 数据授权, 给用户授权数据资源
// 查询数据资源, 并生成审核表单数据
// 如果用户有所有资源的管理权限，则直接授权
//  1. 查询用户信息，用户ID是admin
//  2. 查询用户角色，有内部角色
//  3. 查询用户对该资源的权限，有管理权限
//
// 如果用户没有管理权限，那就发送到审核流，由审核流进行审核
func (u *useCase) DataResourceAuth(ctx context.Context, req *dto.DataResourceAuthReqArg) error {
	handler := u.newAuthHandler(req)
	if handler == nil {
		return errorcode.UnsupportedResourceTypeErr.Desc()
	}
	if err := handler.ValidateParams(ctx, req); err != nil {
		return err
	}
	//查询数据资源
	resources, err := handler.QueryDataSources(ctx, req.ResourceID...)
	if err != nil {
		log.Errorf("query data sources: %v, error: %v", req.ResourceID, err)
		return err
	}
	//当前用户具备全部资源管理权限时直接授权，否则进入审核流
	canDirect, err := u.canDirectGrant(ctx, req)
	if err != nil {
		return err
	}
	if canDirect {
		return u.grantDirectly(ctx, handler, resources, req)
	}
	//查询审核表单数据
	dagMetaID, formData, err := u.getRunInstanceForm(ctx)
	if err != nil {
		return err
	}
	//发送审核请求到审核流
	for i, resource := range resources {
		//生成审核表单数据
		payload, err := handler.GenAuditContent(i, resource, req)
		if err != nil {
			return errorcode.AuditContentGenerationFailedErr.Detail(err.Error())
		}
		//参数置换
		args := make(map[string]any)
		for key, value := range formData {
			args[value] = payload[key]
		}
		//运行审核流程
		if err = u.automationDriven.RunInstanceForm(ctx, dagMetaID, args); err != nil {
			return err
		}
	}
	return nil
}

// DataAuthApprovalOperation 审核通过后：根据 body 中的 resource_type（或 data_type）分发，当前支持数据视图与知识网络，落地为 ISF 策略创建；知识网络在可选参数齐全时还会同步 DIP 数字员工 bkn。
func (u *useCase) DataAuthApprovalOperation(ctx context.Context, body *dto.DataAuthApprovalOperationReq) error {
	req := &dto.DataResourceAuthReqArg{
		ResourceType: body.DataType,
	}
	handler := u.newAuthHandler(req)
	if handler == nil {
		return errorcode.UnsupportedResourceTypeErr.Desc()
	}
	auditContent := make(map[string]any)
	if err := json.Unmarshal([]byte(body.AuditData), &auditContent); err != nil {
		return errorcode.Desc(errorcode.PublicInvalidParameterJson)
	}
	return handler.GrantPolicyAfterApproval(ctx, auditContent)
}
