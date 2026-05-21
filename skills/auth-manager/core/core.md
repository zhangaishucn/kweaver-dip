---
name: "auth-manager-core"
description: "数据权限管理核心概念与快速参考。需要快速了解能力、端点与环境时使用。"
---

# 数据权限管理 — 核心概念

> 快速导航: [SKILL.md](../SKILL.md) | [申请人发现](../references/applicant-discovery.md) | [资源发现](../references/resource-discovery.md) | [管理控制台用户搜索](../references/console-user-search.md) | [用户角色查询](../references/user-role-discovery.md) | [数字员工查询](../references/digital-human-discovery.md) | [行列规则接口](../references/data-model-row-column-rules.md) | [申请参考](../references/auth-apply.md) | [查询参考](../references/auth-query.md)
> **共享约束**: [核心约束](./core-constraints.md) | **文档指南**: [README.md](../README.md)

## 能力一览

| 能力 | 说明 | API |
|------|------|-----|
| 申请人发现 | 缺 `applicant_id` 时按用户名/账号检索并回填 | 见 `references/applicant-discovery.md` |
| 资源发现 | 缺 `resource_id` 时按名称检索候选并回填 | 见 `references/resource-discovery.md` |
| 管理控制台用户搜索 | 全量/按部门搜索用户，支持申请人定位 | 见 `references/console-user-search.md` |
| 用户角色查询 | 按用户查角色、按角色查成员 | 见 `references/user-role-discovery.md` |
| 数字员工查询 | 查询数字员工列表与详情 | 见 `references/digital-human-discovery.md` |
| 行列规则接口 | `data_model` 视图行列规则增删改查 | 见 `references/data-model-row-column-rules.md` |
| 权限申请 | 为资源申请操作权限 | `POST /api/auth-service/v1/data-auth/apply` |
| 权限批量校验 | 批量校验是否具备所列操作 | `POST /api/auth-service/v1/data-resource/operations` |
| 枚举 | `resource_type`、操作、访问者类型 | 见 `resources/*.md` 与 `enum.go` |

## 环境与前缀

```bash
# 示例；以部署为准
export AUTH_SERVICE_BASE_URL="http://127.0.0.1:8155"
# 请求头：Authorization: Bearer <access_token>
# Content-Type: application/json
```

**请求头格式约束**：调用接口时必须携带 `Authorization: Bearer <access_token>` 与 `Content-Type: application/json`。

## 极简示例

### 申请（片段）

见 [references/auth-apply.md](../references/auth-apply.md) 全文；要点：`resource_id`（数组）、`auth_operations`（数组）、`expired_at`（数字）。

### 批量校验（片段）

见 [references/auth-query.md](../references/auth-query.md) 全文；要点：`resources`（`object_id` + `object_type`）、`action`（字符串数组）。

## 何时读主入口

涉及 **意图识别顺序**、**门禁步骤**、**路由总览**、**任务进度清单（todolist）** 时须打开 [SKILL.md](../SKILL.md)。
