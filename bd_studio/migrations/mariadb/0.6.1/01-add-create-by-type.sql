-- Copyright The kweaver.ai Authors.
--
-- Licensed under the Apache License, Version 2.0.
-- See the LICENSE file in the project root for details.

-- ==========================================
-- 0.6.0 → 0.6.1 升级脚本
-- t_bd_resource_r / t_bd_product_r：新增 f_create_by_type 列
-- 使用 IF NOT EXISTS：兼容已通过 init.sql 建表的环境（已有这些列）。
-- ==========================================
USE kweaver;

ALTER TABLE t_bd_resource_r
  ADD COLUMN IF NOT EXISTS f_create_by_type VARCHAR(20) NOT NULL DEFAULT 'user' AFTER f_create_by;

ALTER TABLE t_bd_product_r
  ADD COLUMN IF NOT EXISTS f_create_by_type VARCHAR(20) NOT NULL DEFAULT 'user' AFTER f_create_by;
