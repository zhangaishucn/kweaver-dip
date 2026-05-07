CREATE DATABASE IF NOT EXISTS kweaver DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE kweaver;

CREATE TABLE IF NOT EXISTS t_digital_employee (
  id CHAR(36) NOT NULL COMMENT '数字员工 ID，等同于 agentId',
  kweaver_token VARCHAR(255) NULL COMMENT '数字员工的 KWeaver Token',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '标记数字员工是否被删除',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数字员工信息表';
