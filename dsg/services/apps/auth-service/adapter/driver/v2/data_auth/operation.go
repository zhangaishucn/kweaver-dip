package data_auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kweaver-ai/idrm-go-frame/core/transport/rest/ginx"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/form_validator"
)

// ApprovalOperation 审核通过之后的操作
//
//	@Description	审核通过后按 body.resource_type 等资源信息执行后续逻辑（如创建策略）
//	@Tags			数据授权
//	@Summary		审核通过后操作
//	@Accept			json
//	@Produce		json
//	@Param			_	body		dto.DataAuthApprovalOperationReq	true	"请求参数，body 字段内为业务参数"
//	@Success		200	{object}	rest.HttpError				"成功响应参数"
//	@Failure		400	{object}	rest.HttpError				"失败响应参数"
//	@Router			/api/auth-service/v1/data-auth/operation [post]
func (s *Controller) ApprovalOperation(c *gin.Context) {
	req := &dto.DataAuthApprovalOperationReq{}
	if _, err := form_validator.BindJsonAndValid(c, req); err != nil {
		switch err.(type) {
		case form_validator.ValidErrors:
			ginx.ResErrJson(c, errorcode.Detail(errorcode.PublicInvalidParameterJson, err))
		default:
			ginx.ResErrJsonWithCode(c, http.StatusBadRequest, errorcode.Desc(errorcode.PublicInvalidParameterJson))
		}
		return
	}

	if err := s.authDomain.DataAuthApprovalOperation(c.Request.Context(), req); err != nil {
		c.Writer.WriteHeader(http.StatusBadRequest)
		ginx.ResErrJson(c, err)
		return
	}

	ginx.ResOKJson(c, errorcode.Success)
}
