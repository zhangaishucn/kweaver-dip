# DIP Studio 数据库设计

## t_studio_config

- rds: MariaDB
- db: kweaver
- table: t_studio_config
- description: DIP Studio 平台配置
- schema:

| 字段 | 数据类型 | 允许为空 | 索引 | 备注 |
| -- | -- | -- | -- | -- |
| id | INT | NOT NULL | PK | 自增主键 |
| kweaver_base_url | VARCHAR(255) |  |  | KWeaver 服务连接地址 |
| openclaw_address | VARCHAR(255) |  |  | OpenClaw 网关连接地址 |
| openclaw_token | VARCHAR(255) |  |  | OpenClaw 网关 Token |

## t_digital_employee

- rds: MariaDB
- db: kweaver
- table: t_digital_employee
- description: 数字员工信息表
- schema:

| 字段 | 数据类型 | 允许为空 | 索引 | 备注 |
| -- | -- | -- | -- | -- |
| id | CHAR(36) | NOT NULL | PK | 数字员工 ID，等同于 agentId |
| kweaver_token | VARCHAR(255) |  |  | 数字员工的 KWeaver Token |
| bkn_scope | VARCHAR(4096) |  |  | 数字员工的知识范围，逗号隔开的 id 列表 |
| is_deleted | BOOLEAN |  |  | 标记数字员工是否被删除 |