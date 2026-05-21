package driven

import (
	"github.com/google/wire"
	"github.com/kweaver-ai/idrm-go-common/audit"
	"github.com/kweaver-ai/idrm-go-frame/core/utils/httpclient"

	GoCommon "github.com/kweaver-ai/idrm-go-common"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/database"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/gorm"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/util"
)

var Set = wire.NewSet(
	database.New,
	wire.Bind(new(database.Interface), new(*database.Client)),
	gorm.NewUserRepo,
	util.NewHTTPClient,
	httpclient.NewMiddlewareHTTPClient,

	audit.Discard,
	GoCommon.Set,
)
