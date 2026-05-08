# 初始化引导

## 业务流程

### 前提

- OpenClaw 的主目录（通常是 `~/.openclaw/`）挂载到 Studio 服务容器的 `/root/.openclaw/` 路径，Studio 服务可以读取到  `/root/.openclaw/openclaw.json` 配置文件。

```mermaid

sequenceDiagram 

participant SW as Web
participant BE as Studio Backend (Express)
participant OC as OpenClaw
participant KC as KWeaver Core

opt 配置 OpenClaw 连接信息
  activate BE
  BE ->> BE: 读取 t_studio_config

  alt 已配置 OpenClaw 连接
    BE ->> SW: 返回 ready 状态
  end

  alt 未配置 OpenClaw 连接
      alt 使用外置 OpenClaw
        SW ->> SW: 填充 OpenClaw 网关地址：ws://<hostIP>:19001
      end
      alt 使用内置 OpenClaw
        SW ->> SW: 填充 OpenClaw 网关地址：ws://127.0.0.1:19001
      end
    BE ->> OC: 从 openclaw.json 中读取 gateway.auth.token 字段
    BE ->> SW: 填充 OpenClaw 网关 Token
    BE ->> SW: 填充 KWeaver 默认 SVC 地址：http://bkn-backend-svc:13014
  end
end

opt 选择预置数字员工
  SW ->> BE: 读取预置数字员工配置
  BE ->> BE: 遍历 built-in/digital-human 
  BE ->> SW: 返回预置数字员工配置
  SW ->> SW: 选择预置数字员工
end

opt 执行配置和创建
BE ->> OC: 与 OpenClaw Gateway 建立 WebSocket 连接
BE ->> BE: 写入 t_studio_config
BE ->> OC: 创建预置数字员工
end
```
## 使用外置/内置 OpenClaw

使用环境变量 `USE_EXTERNAL_OPENCLAW` 来判断使用外置/内置 OpenClaw，默认为 `false`

## openclaw 命令

### 读取 OpenClaw 配置
检查 t_studio_config.openclaw_address 和 t_studio_config.openclaw_token 是否配置

如果有任意值缺失，则表示 DIP Studio 未完成与 OpenClaw 的连接配置。

## 初始化 Studio

#### 配置连接信息

Studio Backend 读取完配置后，向前端返回配置信息，用户可以在 Web 修改配置信息。配置项包括：

* OpenClaw 网关连接地址
* OpenClaw 网关 Token
* KWeaver 服务地址（访问 KWeaver API 需要，可选）

用户修改并确认配置后发送初始化请求到 Studio Backend， Studio Backend 执行初始化操作：

1. 与 OpenClaw Gateway 建立 WebSocket 连接。
2. 持久化配置到 t_studio_config
3. 创建 `assets/`目录，执行 OpenSSL 命令生成 Ed25519 PEM 私钥和 PEM 公钥，用于调用 OpenClaw Gateway 接口时进行签名：
```bash
cd assets
openssl genpkey -algorithm ED25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
```
4. 执行 `npm run init:agents` 初始化 OpenClaw 默认配置、built-in agents 以及 extensions。

#### 创建数字员工

用户可以在系统初始化时选择是否需要创建预置的数字员工。当前版本（v0.4.0）包含两个数字员工：
* BKN Creator
* 数据分析员

创建预置数字员工的实现逻辑如下：

1. Studio Web 向 Studio Backend  请求获取预置数字员工的列表；
2. Studio Backend 读取 built-in 目录，按规则解析出数字员工的配置：
```mermaid
sequenceDiagram

participant SW as Studio Web
participant BE as Studio Backend

SW ->> BE: GET /v1/digital-human/built-in

loop 递归 built-in/ 下子目录
	BE ->> BE: 读取 metadata.json
	BE ->> BE: 过滤 type 是 "digital-human" 的配置
end

BE ->> SW: 返回数字员工配置列表
```

预置数字员工的存放目录遵循以下结构：
```
built-in
|-- <digital_human_folder>/
|    |-- metadata.json
|    |-- SOUL.md
|    |-- IDENTITY.md
|    |-- skills/
|        |-- *.skill
```

metadata.json 遵循以下结构：

```json
{
  "type": "digital-human",
  "id": string,
  "name": string,
  "description": string,
  "is_builtin": true
}
```

3. 用户选择需要创建的预置数字员工，这一步也可以跳过。


#### 执行初始化

在执行系统初始化时，Studio Web 需要执行两阶段调用：

* 阶段一：初始化与 OpenClaw 的连接，持久化连接配置。
* 阶段二：连接成功后，创建用户选择的预置数字员工。

创建数字员工时，按以下流程执行：

1. 调用 POST /v1/skills/install 安装 `metadata.json` 所在目录 `skills/*.skill` 所有技能
2. 读取 IDENTITY.md 和 SOUL.md 以及安装的 skills 列表，调用 POST /v1/digital-human 创建数字员工。

#### 更新数字员工

在系统中已经创建数字员工的情况下，可以进行数字员工的设定和技能更新。

```mermaid
sequenceDiagram

participant BE as Studio Backend(Express)
participant OC as OpenClaw

BE ->> OC: 获取指定 ID 数字员工

alt 无返回结果
  BE ->> OC: 创建新数字员工
end

alt 有返回结果
  BE ->> OC: 安装新 Skill
  BE ->> BE: 合并数字员工的 Skill 列表
  BE ->> BE: 读取 SOUL.md 和 IDENTITY.md
  BE ->> BE: 调用更新数字员工 Logic
end
```

## 编辑系统配置

admin 在完成初始化之后，可以再次进入系统配置界面修改配置。

```mermaid
sequenceDiagram

participant SW as Web
participant BE as Studio Backend (Express)
participant OC as OpenClaw

SW ->> BE: 读取配置
BE ->> BE: 读取 t_studio_config

BE ->> SW: 返回 OpenClaw 连接信息和 KWeaver 连接信息

SW ->> SW: 下一步

BE ->> OC: 读取预置数字员工
BE ->> SW: 返回预置数字员工列表（标记是否创建）

```

## HTTP 接口

Studio Backend 提供以下 HTTP 接口：

- 获取 DIP Studio 系统初始化状态；
- 获取 OpenClaw 配置；
- 完成 DIP Studio 系统初始化；
- 获取预置数字员工列表；
- 创建预置数字员工；
