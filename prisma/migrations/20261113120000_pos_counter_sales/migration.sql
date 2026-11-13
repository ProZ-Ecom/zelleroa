-- Counter (POS) selling.
--
-- Three new tables and two columns on `orders`. Nothing existing changes
-- meaning: every online order keeps `store_id` and `pos_session_id` NULL, and
-- `order_source` gains a value rather than losing one.
--
-- The unique index on `orders.invoice_number` is the important one. Until now
-- the number was typed by an admin at shipping time and checked with a SELECT,
-- which is safe only because one person does it at a time. A counter bill
-- prints its number the instant it is created, so two cashiers billing in the
-- same second would both pass that check and write the same number. The index
-- makes a duplicate impossible at the database, which is what a GST series
-- needs. Verified zero duplicates before adding it.

CREATE TABLE `pos_stores` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `address` TEXT NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `state_code` VARCHAR(2) NULL,
  `pincode` VARCHAR(20) NULL,
  `phone` VARCHAR(20) NULL,
  `gstin` VARCHAR(20) NULL,
  `invoice_prefix` VARCHAR(20) NOT NULL DEFAULT 'POS',
  `max_cashier_discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_pos_stores_uuid` (`uuid`),
  UNIQUE INDEX `uq_pos_stores_code` (`code`),
  INDEX `fk_pos_stores_created_by` (`created_by`),
  INDEX `fk_pos_stores_updated_by` (`updated_by`),
  CONSTRAINT `fk_pos_stores_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_pos_stores_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NOT NULL DEFAULT (UUID()),
  `store_id` BIGINT UNSIGNED NOT NULL,
  `staff_user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `opened_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `opening_cash` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `closed_at` TIMESTAMP(0) NULL,
  `closing_cash_counted` DECIMAL(12,2) NULL,
  `expected_cash` DECIMAL(12,2) NULL,
  `cash_variance` DECIMAL(12,2) NULL,
  `variance_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_pos_sessions_uuid` (`uuid`),
  INDEX `fk_pos_sessions_store` (`store_id`),
  INDEX `fk_pos_sessions_created_by` (`created_by`),
  INDEX `fk_pos_sessions_updated_by` (`updated_by`),
  INDEX `idx_pos_sessions_staff_status` (`staff_user_id`, `status`),
  INDEX `idx_pos_sessions_opened_at` (`opened_at`),
  CONSTRAINT `fk_pos_sessions_store` FOREIGN KEY (`store_id`) REFERENCES `pos_stores` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pos_sessions_staff` FOREIGN KEY (`staff_user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pos_sessions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_pos_sessions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pos_invoice_counters` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `series` VARCHAR(20) NOT NULL DEFAULT 'SALE',
  `financial_year` VARCHAR(10) NOT NULL,
  `last_number` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_pos_counter_series` (`store_id`, `series`, `financial_year`),
  CONSTRAINT `fk_pos_counters_store` FOREIGN KEY (`store_id`) REFERENCES `pos_stores` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `orders`
  MODIFY COLUMN `order_source` ENUM('CUSTOMER_DIRECT','AGENT_PLACED_FOR_CUSTOMER','AGENT_OWN','POS') NOT NULL DEFAULT 'CUSTOMER_DIRECT',
  ADD COLUMN `store_id` BIGINT UNSIGNED NULL AFTER `cancelled_by_user_id`,
  ADD COLUMN `pos_session_id` BIGINT UNSIGNED NULL AFTER `store_id`,
  ADD INDEX `fk_orders_store` (`store_id`),
  ADD INDEX `fk_orders_pos_session` (`pos_session_id`),
  ADD UNIQUE INDEX `uq_orders_invoice_number` (`invoice_number`),
  ADD CONSTRAINT `fk_orders_store` FOREIGN KEY (`store_id`) REFERENCES `pos_stores` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_orders_pos_session` FOREIGN KEY (`pos_session_id`) REFERENCES `pos_sessions` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
