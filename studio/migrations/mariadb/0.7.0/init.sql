CREATE DATABASE IF NOT EXISTS kweaver DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_config (
  id INT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  kweaver_base_url VARCHAR(255) NULL COMMENT 'KWeaver 服务连接地址',
  openclaw_address VARCHAR(255) NULL COMMENT 'OpenClaw 网关连接地址',
  openclaw_token VARCHAR(255) NULL COMMENT 'OpenClaw 网关 Token',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DIP Studio 平台配置';

CREATE TABLE IF NOT EXISTS t_studio_user_preference (
    user_id VARCHAR(255) NOT NULL COMMENT '用户ID（与登录主体一致，OAuth subject 等可能长于 36）',
    pinned_digital_human_ids JSON NOT NULL DEFAULT ('[]') COMMENT '侧栏钉选数字员工 ID 列表',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Studio 用户偏好表';

CREATE TABLE IF NOT EXISTS t_digital_employee (
  id CHAR(36) NOT NULL COMMENT '数字员工 ID，等同于 agentId',
  app_id CHAR(36) NULL COMMENT '数字员工绑定的应用账号 ID',
  kweaver_token VARCHAR(255) NULL COMMENT '数字员工的 KWeaver Token',
  bkn_scope VARCHAR(4096) NULL COMMENT '数字员工的知识范围，逗号隔开的 id 列表',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '标记数字员工是否被删除',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数字员工信息表';

CREATE TABLE IF NOT EXISTS t_studio_account_token (
  f_id VARCHAR(255) NOT NULL COMMENT '主键；f_type=user 时为平台 userId；f_type=app 时为 appId（全表唯一）',
  f_type VARCHAR(16) NOT NULL COMMENT 'app：应用账号；user：用户代理 PAT',
  f_token TEXT NOT NULL COMMENT '访问 BKN 的令牌串',
  PRIMARY KEY (f_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按主体（用户或应用）存储的 KWeaver/BKN 访问令牌';
