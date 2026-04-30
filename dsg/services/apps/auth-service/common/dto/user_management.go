package dto

import (
	"context"
	"runtime"
	"strconv"

	"github.com/kweaver-ai/idrm-go-common/interception"
	"github.com/kweaver-ai/idrm-go-common/middleware"
	middleware_v1 "github.com/kweaver-ai/idrm-go-common/middleware/v1"
	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
)

type UserInfo struct {
	Name       string               `json:"name"`
	Roles      []string             `json:"roles"`
	ParentDeps [][]ParentDepartment `json:"parent_deps"`
	Id         string               `json:"id"`
}

type ParentDepartment struct {
	Id   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
	Type string `json:"type,omitempty"`
}

// GetUser 从
func GetUser(c context.Context) (userInfo *UserInfo) {
	if u, err := middleware_v1.UserFromContext(c); err == nil {
		return &UserInfo{
			Name: u.Name,
			Id:   u.ID,
		}
	}
	value := c.Value(interception.InfoName)

	if value == nil {
		return &UserInfo{}
	}

	return value.(*UserInfo)
}

func ObtainUserInfo(c context.Context) (*middleware.User, error) {
	//获取用户信息
	value := c.Value(interception.InfoName)
	if value == nil {
		log.Error("ObtainUserInfo Get TokenIntrospectInfo not exist")
		return nil, errorcode.GetUserInfoFailedErr.Err()
	}
	//tokenIntrospectInfo, ok := value.(hydra.TokenIntrospectInfo)
	user, ok := value.(*middleware.User)
	if !ok {
		pc, _, line, _ := runtime.Caller(1)
		log.Error("transfer hydra TokenIntrospectInfo error" + runtime.FuncForPC(pc).Name() + " | " + strconv.Itoa(line))
		return nil, errorcode.GetUserInfoFailedErr.Err()
	}
	return user, nil
}
