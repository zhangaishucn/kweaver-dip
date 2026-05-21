# 数据权限管理技能

> **技能名称**: auth-manager  
> **版本**: 1.3.4（以 [SKILL.md](./SKILL.md) 元数据为准）  
> **最后更新**: 2026-05-18

## 概述

本技能面向 **auth-service**：统一完成**权限申请**与**权限批量校验**的意图识别、参数校验与接口构造说明。适用于「申请数据/知识网络/行列规则权限」「查询某资源是否具备指定操作」等场景。

## 快速开始

| 层级 | 文档 | 用途 |
|------|------|------|
| L1 | [SKILL.md](./SKILL.md) | **主入口** — 入参、门禁、路由、**任务进度清单（todolist）**、渐进式加载指南 |
| L1 | [core/core.md](./core/core.md) | 核心概念、端点与环境速览 |
| L1 | [core/core-constraints.md](./core/core-constraints.md) | **共享约束**（单一事实来源） |
| L2 | [references/applicant-discovery.md](./references/applicant-discovery.md) | 缺 `applicant_id` 时按用户名/账号检索候选并回填 |
| L2 | [references/resource-discovery.md](./references/resource-discovery.md) | 缺 `resource_id` 时按名称检索候选并回填 |
| L2 | [references/department-discovery.md](./references/department-discovery.md) | 部门查询：按成员可见范围列举部门 |
| L2 | [references/group-discovery.md](./references/group-discovery.md) | 用户组查询：按关键词分页检索用户组 |
| L2 | [references/group-members-discovery.md](./references/group-members-discovery.md) | 用户组成员查询：按组ID分页检索成员 |
| L2 | [references/app-account-discovery.md](./references/app-account-discovery.md) | 应用账户查询：分页检索 app 账户 |
| L2 | [references/console-user-search.md](./references/console-user-search.md) | 管理控制台用户搜索：全量/按部门检索用户及角色范围规则 |
| L2 | [references/user-role-discovery.md](./references/user-role-discovery.md) | 用户角色查询：按用户查角色、按角色查成员 |
| L2 | [references/digital-human-discovery.md](./references/digital-human-discovery.md) | 数字员工列表/详情查询（独立文档） |
| L2 | [references/data-model-row-column-rules.md](./references/data-model-row-column-rules.md) | data_model 视图行列规则增删改查（独立文档） |
| L2 | [references/auth-apply.md](./references/auth-apply.md) | `POST /data-auth/apply` 请求体、cURL、`kweaver call` |
| L2 | [references/auth-query.md](./references/auth-query.md) | `POST /data-resource/operations` 批量校验 |
| L2 | [resources/resource.md](./resources/resource.md) | `resource_type` / `object_type` |
| L2 | [resources/operations.md](./resources/operations.md) | `auth_operations` / `action` |
| L2 | [resources/accessors.md](./resources/accessors.md) | `applicant_type` / `accessor_type` / `subject` |
| L2 | [examples/row-rules.md](./examples/row-rules.md) | `row_rules`（SQL / JSON）示例 |

## 核心能力

1. **权限申请** — `POST /api/auth-service/v1/data-auth/apply`，多类 `resource_type`。
2. **权限批量校验** — `POST /api/auth-service/v1/data-resource/operations`，对多条资源校验是否**同时具备**请求中的全部 `action`。
3. **枚举对齐** — 与 `resources/*.md` 及 `idrm-go-common/rest/authorization/enum.go` 一致。
4. **申请人/资源发现** — 支持缺 `applicant_id`、缺 `resource_id` 的前置检索回填。
5. **数字员工查询（独立）** — 支持数字员工列表与详情检索。
6. **行列规则接口（独立）** — 提供 `data_model` 视图行列规则增删改查索引。
7. **统一失败重试** — 所有接口最多重试一次，避免死循环。
8. **管理控制台用户搜索** — 明确 `role` 必填与角色范围差异，支持全量和按部门检索用户。
9. **用户角色查询** — 明确按用户查角色与按角色查成员两类接口及参数约束。
10. **组织对象检索** — 支持部门、用户组、组成员、应用账户查询，便于补齐申请人与上下文。

## 任务进度清单（todolist）

与 `smart-data-analysis` 对齐：总入口 **步骤一～三**（`阶段：总控制台`），查询分支 **步骤 4～8**（`阶段：查询`），申请分支 **步骤 4～11**（`阶段：申请`）。每完成一步须立即输出进度，分支结束标注 **流程完成**。模板见 [SKILL.md](./SKILL.md)「进度显示规范」；子流程细则见 [references/auth-query.md](./references/auth-query.md)、[references/auth-apply.md](./references/auth-apply.md)。

## 设计说明

- **薄入口 + 分层参考**：门禁、路由与 todolist 在 [SKILL.md](./SKILL.md)；可复用约束集中在 [core/core-constraints.md](./core/core-constraints.md)。  
- **HTTP 细节**：`references/auth-apply.md`、`references/auth-query.md`。
- **与 data-quality 对齐思路**：`core/`（概念 + 共享约束）+ `references/`（HTTP 详情）分层（data-quality 单独使用 `reference/` 目录名，本技能将约束置于 `core/` 便于同学浏览）。

## 文档索引

| 文档 | 说明 |
|------|------|
| [SKILL.md](./SKILL.md) | **主入口** |
| [core/core.md](./core/core.md) | 核心概念 (L1) |
| [core/core-constraints.md](./core/core-constraints.md) | 共享约束 |
| [references/applicant-discovery.md](./references/applicant-discovery.md) | 申请人检索与 ID 回填 |
| [references/resource-discovery.md](./references/resource-discovery.md) | 资源检索与 ID 回填 |
| [references/department-discovery.md](./references/department-discovery.md) | 部门查询（独立） |
| [references/group-discovery.md](./references/group-discovery.md) | 用户组查询（独立） |
| [references/group-members-discovery.md](./references/group-members-discovery.md) | 用户组成员查询（独立） |
| [references/app-account-discovery.md](./references/app-account-discovery.md) | 应用账户查询（独立） |
| [references/console-user-search.md](./references/console-user-search.md) | 管理控制台用户搜索（全量/按部门） |
| [references/user-role-discovery.md](./references/user-role-discovery.md) | 用户角色查询（按用户/按角色） |
| [references/digital-human-discovery.md](./references/digital-human-discovery.md) | 数字员工列表/详情查询（独立） |
| [references/data-model-row-column-rules.md](./references/data-model-row-column-rules.md) | data_model 行列规则增删改查（独立） |
| [references/auth-apply.md](./references/auth-apply.md) | 申请 HTTP 模板 |
| [references/auth-query.md](./references/auth-query.md) | 查询 HTTP 模板 |
| [resources/resource.md](./resources/resource.md) | 资源类型 |
| [resources/operations.md](./resources/operations.md) | 操作枚举 |
| [resources/accessors.md](./resources/accessors.md) | 访问者类型 |
| [examples/row-rules.md](./examples/row-rules.md) | 行规则示例 |

## 更新日志

版本以 [SKILL.md](./SKILL.md) frontmatter `version` 为准；暂无独立 `CHANGELOG.md`。
