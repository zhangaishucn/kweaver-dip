package data_auth

import (
	"context"

	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
)

type UseCase interface {
	DataResourceAuth(ctx context.Context, req *dto.DataResourceAuthReqArg) error
}
