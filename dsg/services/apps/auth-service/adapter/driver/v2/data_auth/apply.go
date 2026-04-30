package data_auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kweaver-ai/idrm-go-frame/core/transport/rest/ginx"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/form_validator"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/domain/data_auth"
)

type Controller struct {
	authDomain data_auth.UseCase
}

func NewController(authDomain data_auth.UseCase) *Controller {
	return &Controller{authDomain: authDomain}
}

// Apply 数据资源权限申请
//
//	@Description	数据资源权限申请
//	@Tags			数据授权
//	@Summary		申请权限
//	@Accept			json
//	@Produce		json
//	@Param			_	body		dto.DataResourceAuthReqArg	true	"请求参数"
//	@Success		200	{object}	rest.HttpError				"成功响应参数"
//	@Failure		400	{object}	rest.HttpError				"失败响应参数"
//	@Router			/api/auth-service/v1/data-auth/apply [post]
func (s *Controller) Apply(c *gin.Context) {
	req := &dto.DataResourceAuthReqArg{}
	if _, err := form_validator.BindJsonAndValid(c, req); err != nil {
		switch err.(type) {
		case form_validator.ValidErrors:
			ginx.ResErrJson(c, errorcode.Detail(errorcode.PublicInvalidParameterJson, err))
		default:
			ginx.ResErrJsonWithCode(c, http.StatusBadRequest, errorcode.Desc(errorcode.PublicInvalidParameterJson))
		}
		return
	}

	if err := s.authDomain.DataResourceAuth(c.Request.Context(), req); err != nil {
		c.Writer.WriteHeader(http.StatusBadRequest)
		ginx.ResErrJson(c, err)
		return
	}

	ginx.ResOKJson(c, errorcode.Success)
}
