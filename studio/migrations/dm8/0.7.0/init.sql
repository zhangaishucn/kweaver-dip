USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_config (
    id INT IDENTITY(1,1) NOT NULL,
    kweaver_base_url VARCHAR(255 char) NULL,
    openclaw_address VARCHAR(255 char) NULL,
    openclaw_token VARCHAR(255 char) NULL,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_studio_config IS 'DIP Studio 平台配置';
COMMENT ON COLUMN t_studio_config.id IS '自增主键';
COMMENT ON COLUMN t_studio_config.kweaver_base_url IS 'KWeaver 服务连接地址';
COMMENT ON COLUMN t_studio_config.openclaw_address IS 'OpenClaw 网关连接地址';
COMMENT ON COLUMN t_studio_config.openclaw_token IS 'OpenClaw 网关 Token';
CREATE TABLE IF NOT EXISTS t_studio_user_preference (
    user_id VARCHAR(255) NOT NULL COMMENT '用户ID（与登录主体一致，OAuth subject 等可能长于 36）',
    pinned_digital_human_ids TEXT NOT NULL DEFAULT '[]' COMMENT '侧栏钉选数字员工 ID 列表（JSON 数组文本）',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    CLUSTER PRIMARY KEY (user_id)
);

COMMENT ON TABLE t_studio_user_preference IS 'Studio 侧栏钉选数字员工（每用户一行）';

CREATE TABLE IF NOT EXISTS t_digital_employee (
    id CHAR(36) NOT NULL,
    app_id CHAR(36) NULL,
    kweaver_token VARCHAR(255 char) NULL,
    bkn_scope VARCHAR(4096 char) NULL,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_digital_employee IS '数字员工信息表';
COMMENT ON COLUMN t_digital_employee.id IS '数字员工 ID，等同于 agentId';
COMMENT ON COLUMN t_digital_employee.app_id IS '数字员工绑定的应用账号 ID';
COMMENT ON COLUMN t_digital_employee.kweaver_token IS '数字员工的 KWeaver Token';
COMMENT ON COLUMN t_digital_employee.bkn_scope IS '数字员工的知识范围，逗号隔开的 id 列表';
COMMENT ON COLUMN t_digital_employee.is_deleted IS '标记数字员工是否被删除';

CREATE TABLE IF NOT EXISTS t_studio_account_token (
    f_id VARCHAR(255) NOT NULL,
    f_type VARCHAR(16) NOT NULL,
    f_token TEXT NOT NULL,
    CLUSTER PRIMARY KEY (f_id)
);

COMMENT ON TABLE t_studio_account_token IS '按主体（用户或应用）存储的 KWeaver/BKN 访问令牌';
COMMENT ON COLUMN t_studio_account_token.f_id IS '主键；f_type=user 时为平台 userId；f_type=app 时为 appId（全表唯一）';
COMMENT ON COLUMN t_studio_account_token.f_type IS 'app：应用账号；user：用户代理 PAT';
COMMENT ON COLUMN t_studio_account_token.f_token IS '访问 BKN 的令牌串';
