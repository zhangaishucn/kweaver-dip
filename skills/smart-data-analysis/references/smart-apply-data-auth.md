# smart-apply-data-auth（权限申请子技能）

用于在权限校验失败时，为指定数据视图发起授权申请。

## 使用场景

- `smart-ask-data` 第 8 步发现候选缺少 `data_query`
- `smart-search-tables` 第 9 步发现候选缺少 `view_detail`
- 用户明确要求“申请数据视图权限/开通查询权限/开通详情权限”

## 输入要求

- `dataview_id`（必填，可多条）
- `auth_operation`（必填：`data_query` 或 `view_detail`）
- `user_id`（必填）
- `user_name`（必填）
- `token`（必填；可通过参数或环境变量）

## 执行步骤

1. 校验入参完整性；缺少必填项则立即返回并停止。
2. 按 `dataview_id` 逐条发起权限申请：
   - 接口：`POST /api/auth-service/v1/data-auth/apply`
   - 脚本：`skills/smart-data-analysis/scripts/apply_data_auth.py`
3. 返回逐条申请结果（成功/失败、失败原因）。

## 输出要求

1. 逐条输出：`dataview_id`、申请权限项、申请结果。
2. 若任一申请失败，必须返回真实错误并提示用户联系管理员或补充参数后重试。
3. 申请完成后提示用户：返回原业务流程（问数/找数）重新执行权限校验步骤。

## 与主流程衔接

- 本子技能只负责“发起权限申请”，不执行问数/找数检索。
- 问数/找数流程在权限不足时应先停止，并提示用户调用本子技能申请权限；申请完成后再重跑原流程。

## 参考

- 详细参数与脚本示例：[`apply-data-auth.md`](apply-data-auth.md)
