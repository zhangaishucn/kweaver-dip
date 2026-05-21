package impl

import (
	"context"
	"strings"
	"time"

	"github.com/kweaver-ai/idrm-go-common/rest/authorization"
	"github.com/kweaver-ai/idrm-go-common/rest/bkn_backend"
	"github.com/kweaver-ai/idrm-go-common/rest/dip_studio"
	"github.com/kweaver-ai/idrm-go-frame/core/telemetry/log"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/errorcode"
)

type knowledgeNetworkHandler struct {
	bknBackend   bkn_backend.Driven
	auth         authorization.Driven
	dipStudio    dip_studio.Driven
	resourceType string
}

func (u *useCase) newKnowledgeNetworkAuthHandler() *knowledgeNetworkHandler {
	return &knowledgeNetworkHandler{
		bknBackend:   u.bknBackend,
		auth:         u.auth,
		dipStudio:    u.dipStudio,
		resourceType: authorization.KNOWLEDGE_NETWORK_RESOURCE_NAME,
	}
}

func (h *knowledgeNetworkHandler) ValidateParams(ctx context.Context, req *dto.DataResourceAuthReqArg) error {
	return nil
}

func (h *knowledgeNetworkHandler) QueryDataSources(ctx context.Context, ids ...string) ([]map[string]any, error) {
	knowledgeNetworkModels := make([]map[string]any, 0)
	for i := 0; i < len(ids); i++ {
		knowledgeNetwork, err := h.bknBackend.GetDetail(ctx, ids[i])
		if err != nil {
			return nil, err
		}
		knowledgeNetworkModels = append(knowledgeNetworkModels, map[string]any{
			"id":   knowledgeNetwork.ID,
			"name": knowledgeNetwork.Name,
		})
	}
	return knowledgeNetworkModels, nil
}

func (h *knowledgeNetworkHandler) genOperationNames(operations []string) string {
	return authorization.JoinDisplay[authorization.KNOperationEnum](operations)
}

func (h *knowledgeNetworkHandler) GenAuditContent(index int, resource map[string]any, req *dto.DataResourceAuthReqArg) (map[string]any, error) {
	expiration := "永不过期"
	if req.ExpiredAt > time.Now().Unix() {
		expiration = time.Unix(req.ExpiredAt, 0).Format(time.DateTime)
	}
	displayData := map[string]any{
		"data_name":          resource["name"],
		"data_cn_type":       getResourceTypeName(req.ResourceType),
		"applicant_name":     req.ApplicantName,
		"applicant_cn_type":  getApplicantTypeName(req.ApplicantType),
		"operations_cn_name": h.genOperationNames(req.AuthOperations),
		"expiration":         expiration,
	}
	auditContent := map[string]any{
		"data_id":        resource["id"],
		"data_name":      resource["name"],
		"data_type":      req.ResourceType,
		"applicant_id":   req.ApplicantID,
		"applicant_type": req.ApplicantType,
		"operations":     strings.Join(req.AuthOperations, ","),
		"expiration":     expiration,
	}
	if dh := strings.TrimSpace(req.DigitalHumanID); dh != "" {
		auditContent["digital_human_id"] = dh
	}
	if bknURL := strings.TrimSpace(req.BknURL); bknURL != "" {
		auditContent["bkn_url"] = bknURL
	}
	result := map[string]any{
		"data_type":    req.ResourceType,
		"display_data": toJsonStr(displayData),
		"audit_data":   toJsonStr(auditContent),
	}
	return result, nil
}

func (h *knowledgeNetworkHandler) GrantPolicyAfterApproval(ctx context.Context, body map[string]any) error {
	// 在写入 ISF 策略后同步将该知识网络登记到 DIP 数字员工 bkn
	if err := h.addGraphToDigitalHuman(ctx, body); err != nil {
		log.Errorf("data auth approval addGraphToDigitalHuman: %v", err)
		return err
	}
	return nil
}

func (h *knowledgeNetworkHandler) addGraphToDigitalHuman(ctx context.Context, body map[string]any) error {
	digitalHumanID := strFromBody(body, "applicant_id")
	dataName := strFromBody(body, "data_name")
	bknURL := strFromBody(body, "data_id")

	if digitalHumanID == "" || dataName == "" || bknURL == "" {
		log.Errorf("data auth approval addGraphToDigitalHuman: missing required fields in body, digital_human_id=%q data_name=%q bkn_url=%q", digitalHumanID, dataName, bknURL)
		return errorcode.Desc(errorcode.PublicInvalidParameterJson)
	}

	_, err := h.dipStudio.AddDigitalHumanKnowledgeNetwork(ctx, digitalHumanID, []dip_studio.BknEntry{
		{Name: dataName, URL: bknURL},
	})
	if err != nil {
		log.Errorf("data auth approval AddDigitalHumanKnowledgeNetwork: digital_human_id=%q data_name=%q err=%v", digitalHumanID, dataName, err)
		return err
	}
	return nil
}
