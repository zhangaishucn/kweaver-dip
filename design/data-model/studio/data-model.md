# DIP Studio 数据库设计

## t_digital_employee

- rds: MariaDB
- db: kweaver
- table: t_digital_employee
- description: 数字员工信息表
- schmma:

| 字段 | 数据类型 | 允许为空 | 索引 | 备注 |
| -- | -- | -- | -- | -- |
| id | CHAR(36) | NOT NULL | PK | 数字员工 ID，等同于 agentId |
| kweaver_token | VARCHAR(255) |  |  | 数字员工的 KWeaver Token |
| is_deleted | BOOLEAN |  |  | 标记数字员工是否被删除 |