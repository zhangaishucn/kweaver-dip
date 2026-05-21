# 数据权限管理 — 核心约束（共享引用）

> 单一事实来源：本文件汇总 **auth-manager** 技能内各文档应一致的约束。若与 [SKILL.md](../SKILL.md) 摘要冲突，**以本文件为准**并回写主入口。

## 1. 流程门禁

1. **意图优先**：须先判定「**查询权限**」还是「**申请权限**」，再构造请求；未完成意图识别与参数校验前 **不得** 调用接口。  
2. **同轮并存**：若同轮同时含申请与查询，须澄清顺序；**默认先查后申**。  
3. **失败即停**：任一步失败须停止并返回真实错误，不得假称成功。  
4. **进度硬约束**：每完成总入口或分支内任一步，须立即输出「任务进度清单」；当前步未输出进度前不得进入下一步；失败即停，不得将后续步骤标为已完成；分支结束须标注 **流程完成**。清单格式与步骤定义以 [SKILL.md](../SKILL.md) 为准。

## 1.1 接口失败处理（全局约束，防死循环）

1. **适用范围**：本技能内所有 HTTP 接口（包含申请、查询、资源发现、申请人发现、数字员工、行列规则 CRUD）。  
2. **重试上限**：每个接口请求最多 **1 次重试**（总尝试次数最多 2 次）。  
3. **申请接口补充约束**：当 `/data-auth/apply` 需要重试时，重试前必须再次执行同资源/同申请人/同操作的权限预检；若预检已全部 `effect=true`，则直接返回“无需申请”，不再提交重试申请。  
4. **终止条件**：重试后仍失败时立即返回原始错误，禁止递归/循环继续重试。

## 2. 枚举与字段

1. **原值使用**：`resource_type` / `object_type`、`auth_operations` / `action`、`applicant_type` / `accessor_type` / `subject.subject_type` 必须使用英文 **code**，与 [`resources/resource.md`](../resources/resource.md)、[`resources/operations.md`](../resources/operations.md)、[`resources/accessors.md`](../resources/accessors.md) 及 `idrm-go-common/rest/authorization/enum.go` **一致**。
2. **大小写**：枚举值大小写须与定义一致，不得用同义词改写。
3. **类型匹配**：`auth_operations`（申请）或 `action`（查询）必须与对应资源的 `resource_type` / `object_type` **可搭配**，不得跨类型混用。

## 3. 申请分支（`/data-auth/apply`）

1. **申请人必备信息**：须满足以下其一：  
   - 已有 `applicant_id`；  
   - 提供 `applicant_account` / `applicant_name`，先做申请人发现后回填 `applicant_id`。  
2. **申请前先查**：调用 `/data-auth/apply` 前，须先用 `/data-resource/operations`（`subject=applicant`）校验目标操作；若全部 `effect=true`，直接返回“无需申请”。  
3. **数组与时间戳**：`resource_id`、`auth_operations` 须为数组；`expired_at` 须为数字时间戳（秒）。
4. **申请人类型**：`applicant_type` 必须使用枚举原值（如 `user`）。
5. **行列规则资源**：`resource_type` 为 `data_view_row_column_rule` 时 **必须** 提供 `resource_attributes`；其中 `row_rules` 须符合服务端解析（见下条及 [examples/row-rules.md](../examples/row-rules.md)）。
6. **row_rules**：SQL 或 JSON 条件树须可被 auth-service `domain/data_auth/conditions`（`ParseSQLCondition` / JSON 反序列化）接受；**整段** 表达，勿与部分接口的「分号拼条件」约定混用。详见 [examples/row-rules.md](../examples/row-rules.md)。

## 4. 查询分支（`/data-resource/operations`）

1. **请求体**：须包含 `action`（非空数组）；并满足以下其一：  
   - 已有 `resources`（非空数组）；  
   - 提供 `resource_name` + `object_type`，先做资源发现后回填 `resources`。  
   `subject` 可选，缺省为 token 当前用户。
2. **effect 语义**：响应项 `effect: true` 表示对该资源 **请求中列出的全部 `action` 均通过** 策略校验（与 `CurrentUserBatchEnforce` + `HasAllAction` 一致）。详见 [references/auth-query.md](../references/auth-query.md)。

## 4.1 资源发现（缺 ID 时必经）

1. **触发条件**：申请缺 `resource_id` 或查询缺 `resources[].object_id` 时，必须先执行资源发现。  
2. **数据视图来源**：`GET /api/mdl-data-model/v1/data-views?name=<resource_name>`。  
3. **知识网络来源**：`GET /api/bkn-backend/v1/knowledge-networks?name_pattern=<resource_name>`。  
4. **候选处理**：单候选可自动回填；多候选必须澄清；零候选必须停止并返回真实原因。  
5. **禁止臆造**：不得伪造 `resource_id`、`resource_type`、`object_type`。

## 4.2 申请人发现（申请缺 `applicant_id` 时必经）

1. **触发条件**：申请分支缺 `applicant_id` 时，必须先执行申请人发现。  
2. **优先接口**：`GET /api/user-management/v1/account-match?account=<applicant_account>`（账号精确匹配）。  
3. **兜底接口**：`GET /api/user-management/v1/search-in-org-tree?keyword=<applicant_name>&type=user&role=<role>`（用户名搜索）。  
4. **候选处理**：单候选可自动回填；多候选必须澄清；零候选必须停止并返回真实原因。  
5. **禁止臆造**：不得伪造 `applicant_id`、`applicant_name` 或 `applicant_account`。

## 4.2.1 applicant 存在性校验（实现约束）

1. **触发条件**：仅当 `applicant_id` 与当前用户 ID 不一致时执行。  
2. **数字员工校验**：`applicant_type=digital_employee` 时，使用 `GET /api/dip-studio/v1/digital-human/{id}`。  
3. **非数字员工校验**：使用 user-management / authorization 相关接口校验访问者存在性。  
4. **失败即停**：校验失败必须停止后续申请，返回真实错误信息。

## 4.3 数字员工检索（`digital_employee`）

1. **适用条件**：`applicant_type=digital_employee` 且缺少明确 `applicant_id` 时，需先检索数字员工。  
2. **列表接口**：`GET /api/dip-studio/v1/digital-human`。  
3. **详情接口**：`GET /api/dip-studio/v1/digital-human/{id}`。  
4. **候选处理**：单候选可自动回填；多候选必须澄清；零候选必须停止并返回真实原因。  
5. **禁止臆造**：不得伪造数字员工 `id` / `name`。

## 4.4 管理控制台用户搜索（全量 / 按部门）

1. **接口**：`GET /api/user-management/v1/console/search-users/{fields}`。  
2. **必填参数**：`role`（query）与 `fields`（path）必须提供。  
3. **角色一致性**：服务端会校验当前 token 用户是否拥有传入 `role`；不一致返回 `400`。  
4. **全量/未分配组限制**：`department_id` 缺失或为 `-1` 时，仅 `super_admin/sys_admin/sec_admin/audit_admin` 允许调用。  
5. **按部门限制**：`department_id` 为普通部门 ID 时，先校验部门存在，再校验该角色是否在可见范围；不满足返回 `403`。  
6. **查询条件**：`name` 非必填，可改用 `account`、`code`、`manager_name`、`position`、`direct_department_code`。  
7. **分页约束**：`offset>=0`，`1<=limit<=1000`。

## 4.5 用户角色查询（按用户 / 按角色）

1. **按用户查角色**：`GET /api/user-management/v1/users/{user_ids}/{fields}`，其中 `fields` 必须包含 `roles`，且 query 必填 `role`。  
2. **角色一致性**：服务端会校验当前 token 用户是否拥有传入 `role`；不满足返回 `400`。  
3. **按角色查成员**：`GET /api/user-management/v1/role-members/{roles}`，`roles` 为逗号分隔角色 code。  
4. **可用角色枚举**：`super_admin`、`sys_admin`、`audit_admin`、`sec_admin`、`org_manager`、`org_audit`（接口 2）；查询用户信息时可包含 `normal_user`（接口 1 返回项）。  
5. **禁止臆造**：角色名必须使用英文 code 原值，禁止中文、别名或大小写变体。

## 5. 请求头

1. **Bearer**：调用接口时必须携带 `Authorization: Bearer <access_token>` 与 `Content-Type: application/json`。  
2. **凭据来源**：本技能不负责 token 获取或刷新；由调用方按运行环境自行提供有效凭据。

## 6. JSON 与命令行

手工拼接 JSON 易导致 `PublicInvalidParameterJson`。须遵循 [references/auth-apply.md](../references/auth-apply.md)、[references/auth-query.md](../references/auth-query.md) 中的 **heredoc / PowerShell ConvertTo-Json / 脚本** 建议；完整清单以该两文为准。
