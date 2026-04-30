package domain

import (
	"github.com/google/wire"
	common_auth_impl "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/common_auth/impl"
	data_auth_impl "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/data_auth/impl"
)

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(
	//新的auth
	common_auth_impl.NewAuth,
	data_auth_impl.NewDataAuth,
)
