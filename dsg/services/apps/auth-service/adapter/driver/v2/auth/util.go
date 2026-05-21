package auth

import (
	v1 "github.com/kweaver-ai/idrm-go-common/api/auth-service/v1"
	"github.com/kweaver-ai/idrm-go-common/api/auth-service/v1/validation"
	"github.com/kweaver-ai/idrm-go-common/util/validation/field"
	"github.com/kweaver-ai/kweaver-dip/dsg/services/apps/auth-service/common/dto"
)

func validateObjectTypeAndSubjectTypes(objectType string, subjects []dto.Subject) (allErrs field.ErrorList) {
	for i, s := range subjects {
		for _, p := range s.Permissions {
			fpath := field.NewPath("subjects").Index(i).Child("subject_type")
			errs := validation.ValidateSubjectTypeAndObjectTypeV2(v1.SubjectType(s.SubjectType), v1.ObjectType(objectType), v1.Action(p.Action), fpath)
			allErrs = append(allErrs, errs...)
		}
	}
	return
}
