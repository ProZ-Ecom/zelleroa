-- Order cancellation details, delivery timestamp, return workflow extension and replacement workflow.

-- ---------------------------------------------------------------- orders
ALTER TABLE `orders`
  ADD COLUMN `delivered_at` TIMESTAMP(0) NULL,
  ADD COLUMN `cancelled_at` TIMESTAMP(0) NULL,
  ADD COLUMN `cancellation_reason` VARCHAR(100) NULL,
  ADD COLUMN `cancellation_comment` VARCHAR(500) NULL,
  ADD COLUMN `cancelled_by` VARCHAR(20) NULL,
  ADD COLUMN `cancelled_by_user_id` BIGINT UNSIGNED NULL;

CREATE INDEX `idx_order_delivered_at` ON `orders`(`delivered_at`);
CREATE INDEX `idx_order_cancelled_at` ON `orders`(`cancelled_at`);

-- Backfill from the status history (best record we have for orders that already moved).
UPDATE `orders` o
JOIN (
  SELECT `order_id`, MAX(`created_at`) AS at
  FROM `order_status_history`
  WHERE `status` = 'delivered' AND `is_active` = 1
  GROUP BY `order_id`
) h ON h.`order_id` = o.`id`
SET o.`delivered_at` = h.at
WHERE o.`order_status` IN ('delivered', 'returned') AND o.`delivered_at` IS NULL;

UPDATE `orders` SET `delivered_at` = `updated_at`
WHERE `order_status` IN ('delivered', 'returned') AND `delivered_at` IS NULL;

UPDATE `orders` o
JOIN (
  SELECT `order_id`, MAX(`created_at`) AS at
  FROM `order_status_history`
  WHERE `status` = 'cancelled' AND `is_active` = 1
  GROUP BY `order_id`
) h ON h.`order_id` = o.`id`
SET o.`cancelled_at` = h.at, o.`cancelled_by` = 'USER'
WHERE o.`order_status` = 'cancelled' AND o.`cancelled_at` IS NULL;

UPDATE `orders` SET `cancelled_at` = `updated_at`, `cancelled_by` = COALESCE(`cancelled_by`, 'USER')
WHERE `order_status` = 'cancelled' AND `cancelled_at` IS NULL;

-- ------------------------------------------------------- return_requests
ALTER TABLE `return_requests`
  MODIFY `status` ENUM('requested','return_requested','under_review','approved','rejected','pickup_scheduled','picked_up','received','refund_pending','refunded','closed') NOT NULL DEFAULT 'return_requested';

UPDATE `return_requests` SET `status` = 'return_requested' WHERE `status` = 'requested';

ALTER TABLE `return_requests`
  MODIFY `status` ENUM('return_requested','under_review','approved','rejected','pickup_scheduled','picked_up','received','refund_pending','refunded','closed') NOT NULL DEFAULT 'return_requested',
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `unboxing_video_url` VARCHAR(500) NULL,
  ADD COLUMN `approved_by` BIGINT UNSIGNED NULL,
  ADD COLUMN `rejected_by` BIGINT UNSIGNED NULL,
  ADD COLUMN `rejected_at` TIMESTAMP(0) NULL,
  ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
  ADD COLUMN `admin_comment` VARCHAR(500) NULL,
  ADD COLUMN `pickup_scheduled_at` TIMESTAMP(0) NULL,
  ADD COLUMN `completed_at` TIMESTAMP(0) NULL;

CREATE INDEX `idx_return_status` ON `return_requests`(`status`);
CREATE INDEX `idx_return_requested_at` ON `return_requests`(`requested_at`);

-- ----------------------------------------------------- return_request_history
CREATE TABLE `return_request_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `return_request_id` BIGINT UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `note` VARCHAR(500) NULL,
  `actor_user_id` BIGINT UNSIGNED NULL,
  `actor_type` VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_return_hist_request` (`return_request_id`, `created_at`),
  INDEX `idx_return_hist_actor` (`actor_user_id`),
  CONSTRAINT `fk_return_hist_request` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------- replacement_requests
CREATE TABLE `replacement_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NULL,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `unboxing_video_url` VARCHAR(500) NOT NULL,
  `status` ENUM('replacement_requested','under_review','approved','rejected','pickup_scheduled','picked_up','replacement_processing','replacement_shipped','replaced','closed') NOT NULL DEFAULT 'replacement_requested',
  `requested_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` TIMESTAMP(0) NULL,
  `approved_by` BIGINT UNSIGNED NULL,
  `rejected_at` TIMESTAMP(0) NULL,
  `rejected_by` BIGINT UNSIGNED NULL,
  `rejection_reason` VARCHAR(500) NULL,
  `admin_comment` VARCHAR(500) NULL,
  `pickup_scheduled_at` TIMESTAMP(0) NULL,
  `shipped_at` TIMESTAMP(0) NULL,
  `delivered_at` TIMESTAMP(0) NULL,
  `completed_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_replacement_requests_uuid` (`uuid`),
  INDEX `fk_replacement_order` (`order_id`),
  INDEX `fk_replacement_user` (`user_id`),
  INDEX `idx_replacement_status` (`status`),
  INDEX `idx_replacement_requested_at` (`requested_at`),
  CONSTRAINT `fk_replacement_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_replacement_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `replacement_request_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `replacement_request_id` BIGINT UNSIGNED NOT NULL,
  `order_item_id` BIGINT UNSIGNED NOT NULL,
  `quantity` INT NOT NULL,
  `requested_variant_id` BIGINT UNSIGNED NULL,
  `requested_variant_unit_price_id` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `fk_replitem_request` (`replacement_request_id`),
  INDEX `fk_replitem_orderitem` (`order_item_id`),
  INDEX `fk_replitem_variant` (`requested_variant_id`),
  INDEX `fk_replitem_vup` (`requested_variant_unit_price_id`),
  CONSTRAINT `fk_replitem_request` FOREIGN KEY (`replacement_request_id`) REFERENCES `replacement_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_replitem_orderitem` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_replitem_variant` FOREIGN KEY (`requested_variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_replitem_vup` FOREIGN KEY (`requested_variant_unit_price_id`) REFERENCES `variant_unit_prices`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `replacement_request_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `replacement_request_id` BIGINT UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `note` VARCHAR(500) NULL,
  `actor_user_id` BIGINT UNSIGNED NULL,
  `actor_type` VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_replacement_hist_request` (`replacement_request_id`, `created_at`),
  INDEX `idx_replacement_hist_actor` (`actor_user_id`),
  CONSTRAINT `fk_replacement_hist_request` FOREIGN KEY (`replacement_request_id`) REFERENCES `replacement_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
