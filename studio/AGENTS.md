# 数字员工平台

开发数字员工运营平台 DIP Studio 的后端服务。

本项目采用谨慎优先的开发策略。处理任务时，需平衡开发速度与系统稳定性，严格遵守以下规范。

## 技术要求
- 使用 TypeScript 作为开发语言
- 使用 Express 作为 HTTP 服务框架
- 每个函数及参数都必须有文档注释
- 单元测试行覆盖率必须达到 90% 以上
- 每次对 routes 进行更新时，同步更新 `docs/openapi` 下的对应文档，并更新 README.md 中的 API 部分
- `docs/openapi` 下的文档禁止跨模块引用

## 一、技术要求

- 语言与框架：使用 TypeScript 作为开发语言，Express 作为 HTTP 服务框架。
- 文档化：每个函数及参数都必须有完整的文档注释（TSDoc/JSDoc）。
- 质量保证：单元测试行覆盖率必须达到 90% 以上。
- 同步机制：每次对 routes 进行更新时，必须同步更新 `docs/openapi` 下的对应文档，并更新 `README.md` 中的 API 部分。

## 二、项目结构

```text
.
├── AGENTS.md                         # 项目的基本要求
├── package.json                      # npm 脚本与依赖定义，包含 dev:mcp 与 mcp 启动脚本
├── mcporter.json                     # 本地 mcporter 默认配置，注册 dip-studio MCP 服务
├── Dockerfile                        # 容器构建配置，内置 mcporter 与默认 MCP 配置
├── docs/                             # 项目相关的文档
│   ├── openapi/                      # 本服务对外提供的 API
│   └── references/                   # 参考文档
│       ├── openapi/                  # 项目中使用到的外部 API
│       └── openclaw-websocket-rpc/   # OpenClaw WebScoket RPC 接口
├── scripts/                          # 运行、初始化与部署辅助脚本
│   ├── docker-entrypoint.sh          # 容器入口，启动 HTTP 服务与 MCP 服务
│   └── init_agents/                  # 数字员工初始化脚本，同步 dip-studio MCP 到 mcporter 配置
├── chart/                            # Helm 部署配置，暴露 HTTP 与 MCP 服务端口和 Ingress 路径
└── src/                              # 源代码
    ├── app.ts                        # 组装 Express 应用、中间件和路由
    ├── server.ts                     # 读取环境变量并启动 HTTP 服务
    ├── mcp-server.ts                 # 启动 DIP Studio MCP 服务，固定监听 3001 端口
    ├── mcp/                          # MCP Streamable HTTP 应用与工具注册
    │   ├── app.ts                    # 创建 MCP Express 应用
    │   └── tools.ts                  # 注册 MCP 工具
    ├── utils/                        # 通用工具与运行时配置解析
    ├── infra/                        # 基础设施适配层，例如 OpenClaw Gateway WebSocket 客户端
    ├── adapters/                     # 外部资源适配器，基于端口接口整合具体依赖调用
    ├── routes/                       # HTTP 路由定义
    ├── logic/                        # 核心业务逻辑，包含 MCP 工具对应的业务逻辑
    ├── middleware/                   # 通用中间件，例如 404 和错误处理
    ├── errors/                       # 领域内可复用的错误类型
    ├── scripts/                      # 系统初始化脚本
    └── *.test.ts                     # 单元测试与接口测试
```

当前后端服务采用 Express + TypeScript 的分层脚手架。

## 三、开发流程与限制

- 架构核对：编写代码前，先阅读本文档的项目结构确认目录职责。
- 接口规范：编写 HTTP 接口层代码前，必须先检查 `docs/openapi` 下的 OpenAPI Schema 定义，更新 `src/types` 中的接口定义，再编写实现。
- Git 工作流：涉及生成、校验或更新 commit message、PR title、PR description、PR 模板或创建 PR 时，必须先读取并遵循 `skills/git-workflow/SKILL.md`。
- 设计锁定（硬限制）：`docs/design` 目录下的文档是系统设计的来源，不允许修改该目录下的任何内容。
- 更新 README 和 OpenAPI 文档 时，只描述用户使用相关的接口，不包含实现细节。

## 四、LLM 行为准则（Merged Guidelines）

### 1. 先思考，后编码

- 拒绝盲目假设：明确声明你的假设。如果对业务逻辑有任何不确定，必须先提问。
- 透明化权衡：如果存在多种实现路径，请列出优劣对比，不要默默选择。
- 简单方案优先：如果发现更简单的实现方式，请主动推翻复杂方案。
- 疑虑即刻停止：如果 OpenAPI 定义或设计文档存在模糊点，先寻求澄清。

### 2. 简约至上（Simplicity First）

- 最小化实现：只编写解决当前问题所必须的代码，严禁添加未经请求的“灵活性”或“扩展性”。
- 拒绝过度抽象：不为单次使用的逻辑编写抽象层。
- 代码精简：如果 50 行代码能搞定，绝不写 200 行。
- 资深视角：始终反思“资深工程师会觉得这太复杂了吗？”如果是，请简化。

### 3. 外科手术式修改

- 精准触达：只改动必须修改的代码。严禁顺手“改进”邻近代码、注释或格式。
- 风格对齐：即使你有不同的偏好，也必须严格匹配现有的 TypeScript 编码风格。
- 清理衍生垃圾：必须移除因你的修改而导致的无效 import、变量或函数。严禁删除原有的死代码，除非任务明确要求。

### 4. 目标驱动执行

- 任务转化为指标：
  - “增加校验” -> 先写无效输入的测试，再使其通过。
  - “重构模块” -> 确保重构前后测试覆盖率及结果一致。
- 执行计划：对于多步任务，必须先列出简要计划：
  - [步骤] -> 验证方法：[检查项]
  - [步骤] -> 验证方法：[检查项]
- 评估标准：当 PR 中的 diff 记录精准且无副作用、API 与定义严格同步、且没有任何推测性开发时，说明本准则得到了有效执行。
