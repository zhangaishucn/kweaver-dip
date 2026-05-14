-- Copyright The kweaver.ai Authors.
--
-- Licensed under the Apache License, Version 2.0.
-- See the LICENSE file in the project root for details.

-- ==========================================
-- 0.6.0 → 0.6.1 升级脚本
-- t_bd_resource_r / t_bd_product_r：新增 f_create_by_type 列
-- DM8 不支持 ADD COLUMN IF NOT EXISTS，通过 USER_TAB_COLUMNS 检查实现幂等。
-- ==========================================
USE kweaver;

DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
    WHERE UPPER(TABLE_NAME) = 'T_BD_RESOURCE_R' AND UPPER(COLUMN_NAME) = 'F_CREATE_BY_TYPE';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE t_bd_resource_r ADD f_create_by_type VARCHAR(20 CHAR) DEFAULT ''user'' NOT NULL';
    END IF;

    SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
    WHERE UPPER(TABLE_NAME) = 'T_BD_PRODUCT_R' AND UPPER(COLUMN_NAME) = 'F_CREATE_BY_TYPE';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE t_bd_product_r ADD f_create_by_type VARCHAR(20 CHAR) DEFAULT ''user'' NOT NULL';
    END IF;
END;
/
