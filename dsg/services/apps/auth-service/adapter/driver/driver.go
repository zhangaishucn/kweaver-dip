package driver

import (
	"github.com/google/wire"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/resources"

	auth_v2 "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driver/v2/auth"
	data_auth_v2 "github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driver/v2/data_auth"
)

// HttpProviderSet ProviderSet is server providers.
var HttpProviderSet = wire.NewSet(NewHttpServer)

var ProviderSet = wire.NewSet(
	auth_v2.NewController,
	data_auth_v2.NewController,
	resources.NewRegisterClient,
)
