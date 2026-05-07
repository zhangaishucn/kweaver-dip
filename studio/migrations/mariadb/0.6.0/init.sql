-- Active: 1774336938924@@127.0.0.1@3306@kweaver
USE `kweaver`;

CREATE TABLE IF NOT EXISTS `t_studio_user_preference` (
    `user_id` VARCHAR(50) NOT NULL COMMENT '用户ID',
    `pinned_digital_human_ids` JSON NOT NULL DEFAULT ('[]') COMMENT '侧栏钉选数字员工 ID 列表',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Studio 用户偏好表';
