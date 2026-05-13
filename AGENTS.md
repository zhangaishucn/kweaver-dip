# KWeaver DIP 项目

你的任务是开发 KWeaver DIP 项目。

本文档是你的开发指南，包含项目术语、目录结构、开发流程指引。

## 项目术语

**KWeaver DIP**

KWeaver DIP 是企业级数字员工平台，基于 KWeaver Core 开发；KWeaver DIP 以业务知识网络（BKN）为底座，提供 AI 原生的数字员工开发、管理和应用能力。

**KWeaver Core**

KWeaver Core 是面向企业决策智能体的基础平台。它将分散的数据、知识、工具和策略转化为受治理的上下文、安全的执行和可验证的反馈闭环。通过语义建模、实时访问、运行时管控和 TraceAI，帮助 AI 系统在复杂企业环境中可靠地推理、适应和行动。

**业务知识网络（BKN）**

业务知识网络（BKN，Business Knowledge Network）是在组织所定义的业务之上，将数据、逻辑与行动统一映射为可查询、可推理、可执行的语义基础设施，为决策智能体提供的统一语义层。

**ISF**

ISF 是 KWeaver DIP 使用的安全组件，提供用户管理、应用账户管理、用户同步、登录认证、授权、访问控制、安全策略等能力。

**决策智能体（Decision Agent）**

决策智能体是 KWeaver Core 开发的具备决策能力的智能代理组件，可根据预设规则或算法执行特定业务任务。


## 开发流程

首先识别用户需求，根据需求不同读写不同的子目录：
  - 如果要进行项目开发，读取 `design/` 目录下的特性及交互设计文档以及对应的功能模块目录代码。
  - 如果要更新产品介绍，读写仓库根路径下 `README.md` 和 `README.zh.md`
  - 如果要更新 Chart 版本，根据 `deploy/AGENTS.md` 的规则进行操作
  - 如果要更新版本号，读写仓根路径下 `VERSION`

## 项目结构：

项目结构是你确定读写范围的索引，你要先从项目结构开始，采用渐进式披露的方式确定范围 —— 根据需求确定要读写的内容在哪个目录下，然后进一步检索目录下的 AGENTS.md，你会得到关于该模块的进一步结构说明和规则约束。

```
.
├── .github/
│   └── workflows/        # CI/CD 流水线
├── deploy/               # 部署脚本及配置
├── docs/                 # 项目文档
├── design/               # 特性设计及交互设计
├── release-notes/        # 版本发布说明
├── web/                  # 前端代码
├── studio/               # 数字员工平台模块
├── dsg/                  # 数据语义治理模块
├── chat-data/            # “数据分析员”模块
├── hub/                  # 应用商店模块
└── skills/               # AI Agent 技能
└── README.md             # KWeaver DIP 项目介绍（英文版）
└── README.zh.md          # KWeaver DIP 项目介绍（中文版）
└── VERSION               # 当前正在开发的版本号
```
