USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_user_preference (
    user_id VARCHAR(255) NOT NULL COMMENT '用户ID（与登录主体一致，OAuth subject 等可能长于 36）',
    pinned_digital_human_ids TEXT NOT NULL DEFAULT '[]' COMMENT '侧栏钉选数字员工 ID 列表（JSON 数组文本）',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    CLUSTER PRIMARY KEY (user_id)
);

COMMENT ON TABLE t_studio_user_preference IS 'Studio 侧栏钉选数字员工（每用户一行）';
