-- Customer -> agent assignment, order source tracking and transfer history.

ALTER TABLE `users`
  ADD COLUMN `current_agent_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `agent_assigned_at` TIMESTAMP(0) NULL,
  ADD INDEX `idx_users_current_agent` (`current_agent_id`),
  ADD CONSTRAINT `fk_users_current_agent` FOREIGN KEY (`current_agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `orders`
  ADD COLUMN `order_source` ENUM('CUSTOMER_DIRECT','AGENT_PLACED_FOR_CUSTOMER','AGENT_OWN') NOT NULL DEFAULT 'CUSTOMER_DIRECT',
  ADD COLUMN `ordered_by_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `is_manual_customer` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `manual_customer_name` VARCHAR(150) NULL,
  ADD COLUMN `manual_customer_phone` VARCHAR(20) NULL,
  ADD COLUMN `manual_customer_email` VARCHAR(254) NULL,
  ADD INDEX `idx_orders_ordered_by` (`ordered_by_id`),
  ADD INDEX `idx_orders_source_agent` (`order_source`, `agent_id`),
  ADD CONSTRAINT `fk_orders_ordered_by` FOREIGN KEY (`ordered_by_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE `customer_agent_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(64) NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `from_agent_id` BIGINT UNSIGNED NULL,
  `to_agent_id` BIGINT UNSIGNED NOT NULL,
  `action` ENUM('assigned','transferred') NOT NULL,
  `transferred_by` BIGINT UNSIGNED NULL,
  `reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_cag_history_uuid` (`uuid`),
  INDEX `idx_cag_customer` (`customer_id`, `created_at`),
  INDEX `idx_cag_from` (`from_agent_id`),
  INDEX `idx_cag_to` (`to_agent_id`),
  CONSTRAINT `fk_cag_customer` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_cag_from_agent` FOREIGN KEY (`from_agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_cag_to_agent` FOREIGN KEY (`to_agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_cag_actor` FOREIGN KEY (`transferred_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill 1: an agent's own purchases (previously identified only by the buyer being an agent).
UPDATE `orders` o
  JOIN `users` u ON u.id = o.user_id
  JOIN `roles` r ON r.id = u.role_id AND r.slug = 'agent'
SET o.order_source = 'AGENT_OWN', o.ordered_by_id = o.user_id
WHERE o.agent_id IS NULL;

-- Backfill 2: everything else was placed by the customer.
UPDATE `orders` SET `ordered_by_id` = `user_id` WHERE `ordered_by_id` IS NULL;

-- Backfill 3: customers become assigned to the agent of their most recent agent-attributed order,
-- so existing agents keep seeing the customers they already earn commission from.
UPDATE `users` u
  JOIN (
    SELECT o.user_id, o.agent_id
    FROM `orders` o
    JOIN (
      SELECT user_id, MAX(id) AS last_id FROM `orders`
      WHERE agent_id IS NOT NULL AND order_source = 'CUSTOMER_DIRECT'
      GROUP BY user_id
    ) l ON l.last_id = o.id
  ) x ON x.user_id = u.id
SET u.current_agent_id = x.agent_id, u.agent_assigned_at = NOW()
WHERE u.current_agent_id IS NULL AND x.agent_id <> u.id;
