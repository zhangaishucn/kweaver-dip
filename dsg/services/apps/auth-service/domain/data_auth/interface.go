package data_auth

import (
	"context"

	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
)

type UseCase interface {
	DataResourceAuth(ctx context.Context, req *dto.DataResourceAuthReqArg) error
	// DataAuthApprovalOperation 审核通过后按资源类型执行后续操作（如写入授权策略）
	DataAuthApprovalOperation(ctx context.Context, body *dto.DataAuthApprovalOperationReq) error
}
