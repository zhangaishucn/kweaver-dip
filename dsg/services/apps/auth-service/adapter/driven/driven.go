package driven

import (
	"github.com/google/wire"
	"github.com/kweaver-ai/idrm-go-frame/core/utils/httpclient"

	GoCommon "github.com/kweaver-ai/idrm-go-common"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/database"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/gorm"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/adapter/driven/microservice"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/util"
)

var Set = wire.NewSet(
	database.New,
	wire.Bind(new(database.Interface), new(*database.Client)),
	microservice.NewConfigurationCenterRepo,
	microservice.NewUserManagementRepo,
	microservice.NewDataApplicationServiceRepo,
	microservice.NewDataSubjectRepo,
	microservice.NewDataViewRepo,
	microservice.NewDocAuditRESTRepo,
	microservice.NewVirtualizationEngineRepo,
	gorm.NewAuthSubViewRepo,
	gorm.NewAPIAuthorizingRequestRepo,
	gorm.NewIndicatorAuthorizingRequestRepo,
	gorm.NewLogicViewAuthorizingRequestRepo,
	gorm.NewSubViewRepo,
	gorm.NewUserRepo,
	gorm.NewIndicatorRepo,
	gorm.NewIndicatorDimensionalRuleInterfaceRepository,
	gorm.NewTTechnicalIndicatorRepo,
	gorm.NewDataApplicationFormRepo,
	util.NewHTTPClient,
	gorm.NewConsumeAuthRequestRepo,
	httpclient.NewMiddlewareHTTPClient,

	GoCommon.Set,
)
