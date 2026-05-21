package dto

import (
	"encoding/json"
	"errors"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/data_model"
)

// DataAuthApprovalOperationReq 审核通过之后执行操作的请求，body 为业务透传字段（需包含 resource_type 或 data_type）
type DataAuthApprovalOperationReq struct {
	DataType  string `json:"data_type" binding:"required"`  //申请资源类型
	AuditData string `json:"audit_data" binding:"required"` //审核内容JSON字符串
}

// DataAuthFormContent 审核表单内容
type DataAuthFormContent struct {
	DataType    string `json:"data_type" binding:"required"`    //申请资源类型
	DisplayData string `json:"display_data" binding:"required"` //显示数据JSON字符串
	AuditData   string `json:"audit_data" binding:"required"`   //审核内容JSON字符串
}

// DataResourceAuthReqArg 数据资源授权申请请求
type DataResourceAuthReqArg struct {
	ResourceID         []string `json:"resource_id" binding:"required,min=1,max=100"` //申请资源ID列表
	ResourceAttributes []any    `json:"resource_attributes" binding:"omitempty"`      //申请资源的额外属性
	ResourceType       string   `json:"resource_type" binding:"required"`             //申请资源类型
	DataResourceAuthRequest
}

type DataResourceAuthRequest struct {
	ApplicantID    string   `json:"applicant_id" binding:"required,uuid"`     //申请人
	ApplicantName  string   `json:"applicant_name" binding:"required"`        //申请人名称
	ApplicantType  string   `json:"applicant_type" binding:"required"`        //申请人类型
	AuthOperations []string `json:"auth_operations" binding:"required,min=1"` //授权操作列表
	ExpiredAt      int64    `json:"expired_at" binding:"omitempty"`           //权限过期时间时间戳
	// DigitalHumanID 与 BknURL 可选：知识网络授权审核通过后，在写入 ISF 策略后同步将该知识网络登记到 DIP 数字员工的 bkn（二者均非空时才调用 DIP Studio）
	DigitalHumanID string `json:"digital_human_id" binding:"omitempty,uuid"`
	BknURL         string `json:"bkn_url" binding:"omitempty"`
}

type DataAuthSimpleModel struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	FullName string `json:"full_name"`
}

type SubViewRules struct {
	ColumnRules string `json:"column_rules"` // 申请的列，逗号分隔
	RowRules    string `json:"row_rules"`    // 申请的行
}

// GetSubViewRules 当类型是数据视图行列规则的时候，可以调用
func (d *DataResourceAuthReqArg) GetSubViewRules(index int) (*SubViewRules, error) {
	if d.ResourceType != authorization.SUB_VIEW_RESOURCE_NAME {
		return nil, errors.New("resource type is not sub view")
	}
	content := d.ResourceAttributes[index]
	if content == nil {
		return nil, errors.New("content is nil")
	}
	payload, err := json.Marshal(content)
	if err != nil {
		return nil, errors.New("content is not a valid JSON")
	}
	subViewRules := &SubViewRules{}
	err = json.Unmarshal(payload, subViewRules)
	if err != nil {
		return nil, err
	}
	return subViewRules, nil
}

func (s *SubViewRules) LoadRowColumnCondCfg() (*data_model.RowColumnCondCfg, error) {
	content := s.RowRules
	if content == "" {
		return nil, nil
	}
	config := &data_model.RowColumnCondCfg{}
	err := json.Unmarshal([]byte(content), config)
	if err != nil {
		return nil, err
	}
	return config, nil
}
