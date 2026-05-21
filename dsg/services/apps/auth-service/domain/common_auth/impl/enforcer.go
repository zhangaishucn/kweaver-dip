package impl

import (
	"context"

	auth_service_v1 "github.com/kweaver-ai/idrm-go-common/api/auth-service/v1"
	meta_v1 "github.com/kweaver-ai/idrm-go-common/api/meta/v1"
	auth_service "github.com/kweaver-ai/idrm-go-common/rest/auth-service"
	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/configuration_center"
	"github.com/kweaver-ai/idrm-go-common/rest/data_application_service"
	"github.com/kweaver-ai/idrm-go-common/rest/data_view"
	"github.com/kweaver-ai/idrm-go-common/rest/indicator_management"
	"github.com/kweaver-ai/idrm-go-common/rest/user_management"
	goCommomUtil "github.com/kweaver-ai/idrm-go-common/util"
	gutil "github.com/kweaver-ai/idrm-go-common/util"
	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/database"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/database/af_configuration"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/enum"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/util"
	domain "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/common_auth"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/infrastructure/repository/redis"
	"github.com/samber/lo"
	"go.uber.org/zap"
)

const adminUserID = "266c6a42-6131-4d62-8f39-853e7093701c"

type auth struct {
	driven authorization.Driven
	helper *AuthHelper
	ccDB   af_configuration.Interface
}

func NewAuth(
	driven authorization.Driven,
	redisClient *redis.Client,
	ccDriven configuration_center.Driven,
	apiDriven data_application_service.Driven,
	dataViewDriven data_view.Driven,
	indicatorDriven indicator_management.Driven,
	database database.Interface,
	userManagementDriven user_management.DrivenUserMgnt,
) domain.Auth {
	return &auth{
		driven: driven,
		helper: NewAuthHelper(
			redisClient,
			ccDriven,
			apiDriven,
			dataViewDriven,
			indicatorDriven,
			userManagementDriven,
		),
		ccDB: database.AFConfiguration(),
	}
}

// Enforce 策略验证
func (a *auth) Enforce(ctx context.Context, reqs dto.PolicyEnforceReq) ([]bool, error) {
	enforcerResults := make([]bool, 0, len(reqs))
	for _, req := range reqs {
		if req.ObjectType != dto.ObjectAPI.Str() && req.ObjectType != dto.ObjectSubService.Str() {
			enforcerResults = append(enforcerResults, true)
			continue
		}
		arg := &authorization.OperationCheckArgs{
			Accessor: authorization.Accessor{
				ID:   req.SubjectId,
				Type: req.SubjectType,
			},
			Resource: authorization.ResourceObject{
				ID:   req.ObjectId,
				Type: dto.ObjectToResourceType(req.ObjectType),
			},
			Operation: []string{req.Action},
			Method:    "GET",
			Include:   []string{authorization.INCLUDE_OPERATION_OBLIGATIONS},
		}
		result, err := a.driven.OperationCheck(ctx, arg)
		if err != nil {
			log.Errorf("Enforce Error %v", err.Error())
			return nil, err
		}
		enforcerResults = append(enforcerResults, result.Result)
	}
	return enforcerResults, nil
}

// CurrentUserEnforce 当前用户的策略验证
func (a *auth) CurrentUserEnforce(ctx context.Context, req *dto.CurrentUserEnforce) (bool, error) {
	userInfo, err := gutil.GetUserInfo(ctx)
	if err != nil {
		return false, err
	}
	arg := &authorization.OperationCheckArgs{
		Accessor: authorization.Accessor{
			ID:   userInfo.ID,
			Type: dto.SubjectUser.String(),
		},
		Resource: authorization.ResourceObject{
			ID:   req.ObjectId,
			Type: dto.ObjectToResourceType(req.ObjectType),
		},
		Operation: []string{req.Action},
		Method:    "GET",
		Include:   []string{},
	}
	result, err := a.driven.OperationCheck(ctx, arg)
	if err != nil {
		log.Errorf("CheckUserPermission Error %v", err.Error())
		return false, err
	}
	return result.Result, nil
}

// CurrentUserBatchEnforce 当前用户的批量策略验证
func (a *auth) CurrentUserBatchEnforce(ctx context.Context, req *dto.CurrentUserBatchEnforce) ([]*dto.ObjectAuthResultItem, error) {
	userInfo, err := gutil.GetUserInfo(ctx)
	if err != nil {
		return nil, err
	}
	subject := req.Subject
	if subject == nil {
		subject = &dto.SimpleSubject{
			SubjectType: authorization.ACCESSOR_TYPE_USER,
			SubjectId:   userInfo.ID,
		}
	}
	// 如果是admin用户，则直接授权
	if subject.SubjectId == adminUserID {
		return lo.Times(len(req.Resources), func(index int) *dto.ObjectAuthResultItem {
			return &dto.ObjectAuthResultItem{
				ObjectId: req.Resources[index].ObjectId,
				Effect:   true,
			}
		}), nil
	}
	//查询subject是否是是内部角色
	hasInnerRole, err := a.driven.HasRoles(ctx, subject.SubjectId, authorization.InnerBusinessRoles...)
	if err != nil {
		return nil, err
	}
	//内部角色默认有全部的权限
	if hasInnerRole {
		return lo.Times(len(req.Resources), func(index int) *dto.ObjectAuthResultItem {
			return &dto.ObjectAuthResultItem{
				ObjectId: req.Resources[index].ObjectId,
				Effect:   true,
			}
		}), nil
	}
	arg := &authorization.ResourceFilterArgs{
		AllowOperation: true,
		Accessor: authorization.Accessor{
			ID:   subject.SubjectId,
			Type: subject.SubjectType,
		},
		Resources: req.ResourceObjects(),
		Operation: req.Action,
		Method:    "GET",
		Include:   []string{},
	}
	result, err := a.driven.ResourceFilter(ctx, arg)
	if err != nil {
		log.Errorf("CheckUserPermission Error %v", err.Error())
		return nil, err
	}
	grouped := make([]*dto.ObjectAuthResultItem, 0)
	for index, r := range result {
		var item *dto.ObjectAuthResultItem
		if r.Id == req.Resources[index].ObjectId && req.HasAllAction(result[index].AllowOperation) {
			item = &dto.ObjectAuthResultItem{
				ObjectId: req.Resources[index].ObjectId,
				Effect:   true,
			}
		} else {
			item = &dto.ObjectAuthResultItem{
				ObjectId: req.Resources[index].ObjectId,
				Effect:   false,
			}
		}
		grouped = append(grouped, item)
	}
	return grouped, nil
}

// GetObjectsBySubjectId 查询用户的所有权限配置
func (a *auth) GetObjectsBySubjectId(ctx context.Context, req *dto.GetObjectsBySubjectIdReq) (res *dto.GetObjectsBySubjectIdRes, err error) {
	res = &dto.GetObjectsBySubjectIdRes{
		PageResult: dto.PageResult[dto.GetObjectsBySubjectId]{
			Entries: make([]*dto.GetObjectsBySubjectId, 0),
		},
	}
	args := &authorization.AccessorPolicyArgs{
		AccessorID:   req.SubjectId,
		AccessorType: req.SubjectType,
		ResourceType: dto.ObjectToResourceType(req.ObjectType),
		ResourceID:   req.ObjectId,
		Offset:       0,
		Limit:        1000,
	}
	policiesEntries, err := a.driven.GetAccessorPolicy(ctx, args)
	if err != nil {
		log.WithContext(ctx).Error("GetObjectsBySubjectId GetAccessorPolicy", zap.Error(err))
		return nil, err
	}
	if policiesEntries == nil {
		log.WithContext(ctx).Info("=====GetObjectsBySubjectId policiesEntries 是空=====")
		return res, nil
	}

	res.TotalCount = int(policiesEntries.TotalCount)
	for _, policy := range policiesEntries.Entries {
		if policy.Operation == nil {
			continue
		}
		obj := &dto.GetObjectsBySubjectId{
			ObjectId:    policy.Resource.ID,
			ObjectType:  dto.ResourceTypeToObject(policy.Resource.Type),
			Permissions: dto.OperationsToPermissions(*policy.Operation, policy.ExpiresAt),
			ExpiredAt:   lo.ToPtr(meta_v1.NewTime(policy.ExpiresAt)),
		}
		res.Entries = append(res.Entries, obj)
	}
	return res, nil
}

// QueryPolicyExpiredObjects  查询对象中是否有过期的策略，返回有过期的
func (a *auth) QueryPolicyExpiredObjects(ctx context.Context, req *dto.QueryPolicyExpiredObjectsArgs) ([]string, error) {
	hasExpired := make([]string, 0)
	for _, objectKey := range req.ObjectID {
		objectID, objectType := util.SplitField(objectKey)
		arg := &authorization.GetResourcePolicyReq{
			ResourceID:   objectID,
			ResourceType: dto.ObjectToResourceType(objectType),
			Limit:        1000,
		}
		policiesPageResults, err := a.driven.GetResourcePolicy(ctx, arg)
		if err != nil {
			log.Errorf("GetResourcePolicy policies error %v", err.Error())
			return nil, err
		}
		for _, policy := range policiesPageResults.Entries {
			if isExpire(policy.ExpiresAt) {
				hasExpired = append(hasExpired, objectKey)
			}
		}
	}
	return hasExpired, nil
}

func (a *auth) CheckUserPermission(ctx context.Context, req *dto.RulePolicyEnforce) (*dto.RulePolicyEnforceEffect, error) {
	//先检查用户是不是数据owner，允许数据owner做任何操作
	ok, err := a.checkSubjectIsObjectOwner(ctx, string(dto.SubjectUser), req.UserID, req.ObjectType, req.ObjectId)
	if err != nil {
		return nil, err
	}
	if ok {
		return req.NewPolicyEnforceEffect(string(auth_service_v1.PolicyAllow)), nil
	}
	arg := &authorization.AccessorPolicyArgs{
		AccessorID:   req.UserID,
		AccessorType: dto.SubjectUser.String(),
		ResourceType: dto.ObjectToResourceType(req.ObjectType),
		ResourceID:   req.ObjectId,
	}
	policiesPageResult, err := a.driven.GetAccessorPolicy(ctx, arg)
	if err != nil {
		log.Errorf("CheckUserPermission Error %v", err.Error())
		return nil, err
	}
	//根据结果判断是否有通过验证
	effect := enum.EffectDeny
	for _, policy := range policiesPageResult.Entries {
		if dto.OperationsMatchAction(policy.Operation, req.Action) && !isExpire(policy.ExpiresAt) {
			effect = enum.EffectAllow
		}
	}
	return &dto.RulePolicyEnforceEffect{
		ObjectId:   req.ObjectId,
		ObjectType: req.ObjectType,
		Action:     req.Action,
		Effect:     effect,
	}, nil
}

// MenuResourceEnforce 对功能鉴权, 菜单功能鉴权，主体只能是人
func (a *auth) MenuResourceEnforce(ctx context.Context, req *dto.MenuResourceEnforceArg) (policyEnforceEffect *dto.MenuResourceEnforceEffect, err error) {
	//查询下该接口对应有那些菜单
	menuResources, err := a.ccDB.PermissionResources().GetByAPIKey(ctx, req.Path, req.Method)
	if err != nil {
		return nil, err
	}
	//如果不在权限内的，直接放过
	if len(menuResources) == 0 {
		return dto.NewAllowMenuResourceEnforceEffect(), nil
	}
	//按照菜单按钮分组
	menuGroup := lo.GroupBy(menuResources, func(item *af_configuration.PermissionResource) string {
		return item.Resource
	})

	for menuKey, resources := range menuGroup {
		arg := &authorization.OperationCheckArgs{
			Accessor: authorization.Accessor{
				ID:   req.UserID,
				Type: dto.SubjectUser.String(),
			},
			Resource: authorization.ResourceObject{
				ID:   menuKey,
				Type: authorization.RESOURCE_TYPE_MENUS,
			},
			Operation: lo.Times(len(resources), func(index int) string {
				return resources[index].Action
			}),
			Include: []string{authorization.INCLUDE_OPERATION_OBLIGATIONS},
			Method:  "GET",
		}
		result, err := a.driven.OperationCheck(ctx, arg)
		if err != nil {
			log.Errorf("CheckUserPermission Error %v", err.Error())
			return nil, err
		}
		if result.Result {
			return &dto.MenuResourceEnforceEffect{
				Scope:  result.OperationScope(),
				Effect: lo.Ternary(result.Result, dto.EftAllow, dto.EftDeny),
			}, nil
		}
	}
	return dto.NewDenyMenuResourceEnforceEffect(), nil
}

func (a *auth) MenuResourceActions(ctx context.Context, req *dto.MenuResourceActionsArg) (resp *dto.MenuResourceActionsResp, err error) {
	if req.UserID == "" {
		userInfo, err := goCommomUtil.GetUserInfo(ctx)
		if err != nil {
			return nil, err
		}
		req.UserID = userInfo.ID
	}
	//如果是内置业务管理员，允许所有操作
	innerRoles, err := a.driven.HasInnerBusinessRoles(ctx, req.UserID)
	if err != nil {
		return nil, err
	}
	if len(innerRoles) > 0 {
		return &dto.MenuResourceActionsResp{
			ResourceID: req.ResourceID,
			Actions:    auth_service.ActionValueList,
		}, nil
	}
	//查询菜单资源的允许的操作
	args := &authorization.GetResourceOperationsArgs{
		Method: "GET",
		Accessor: authorization.Accessor{
			ID:   req.UserID,
			Type: dto.SubjectUser.String(),
		},
		Resources: []authorization.ResourceObject{
			{
				ID:   req.ResourceID,
				Type: req.ResourceType,
			},
		},
	}
	operations, err := a.driven.GetResourceOperations(ctx, args)
	if err != nil {
		log.Errorf("CheckUserPermission Error %v", err.Error())
		return nil, err
	}
	//根据结果判断是否有通过验证
	actions := make([]string, 0)
	for _, policy := range operations {
		actions = append(actions, policy.Operation...)
	}
	return &dto.MenuResourceActionsResp{
		ResourceID: req.ResourceID,
		Actions:    actions,
	}, nil
}
