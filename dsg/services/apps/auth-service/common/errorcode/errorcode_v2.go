package errorcode

// 由 errorcode.go 中 Public 错误码表迁移为与 auth_error_v2.go 一致的 errorx 形式。

var (
	PublicInternalErr             = publicModule.Description("InternalError", "内部错误")
	PublicInvalidParameterErr     = publicModule.Solution("InvalidParameter", "参数值校验不通过", "", ReadManualSolution)
	PublicInvalidParameterJsonErr = publicModule.Solution("InvalidParameterJson", "参数值校验不通过：json格式错误", "", ReadManualSolution)
	PublicDatabaseErr             = publicModule.Solution("DatabaseError", "数据库异常", "", "请检查数据库状态")
	PublicRequestParameterErr     = publicModule.Solution("RequestParameterError", "请求参数格式错误", "输入请求参数格式或内容有问题", "请输入正确格式的请求参数")
)
