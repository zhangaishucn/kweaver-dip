USE kweaver;

CREATE TABLE IF NOT EXISTS t_digital_employee (
    id CHAR(36) NOT NULL,
    kweaver_token VARCHAR(255 char) NULL,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_digital_employee IS '数字员工信息表';
COMMENT ON COLUMN t_digital_employee.id IS '数字员工 ID，等同于 agentId';
COMMENT ON COLUMN t_digital_employee.kweaver_token IS '数字员工的 KWeaver Token';
COMMENT ON COLUMN t_digital_employee.is_deleted IS '标记数字员工是否被删除';
