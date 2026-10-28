-- Stock rows carry what they cost, goods receipts record what was refused at the
-- door, and goods sent back to a vendor get their own document with a debit note.

-- Cost has only ever lived on the purchase line, so stock could not be valued.
ALTER TABLE `variant_unit_prices`
  ADD COLUMN `cost_price` DECIMAL(10,2) NULL AFTER `base_price`,
  ADD COLUMN `avg_cost` DECIMAL(10,2) NULL AFTER `cost_price`;

-- Seed both from the latest receipt / the weighted average of all receipts, so
-- valuation works on history instead of starting blank.
UPDATE `variant_unit_prices` v
  JOIN (
    SELECT ri.`variant_unit_price_id` AS vup_id,
           SUM(ri.`quantity_received` * ri.`unit_cost`) / NULLIF(SUM(ri.`quantity_received`), 0) AS avg_cost,
           SUBSTRING_INDEX(
             GROUP_CONCAT(ri.`unit_cost` ORDER BY ri.`id` DESC SEPARATOR ','), ',', 1
           ) + 0 AS last_cost
    FROM `purchase_receipt_items` ri
    GROUP BY ri.`variant_unit_price_id`
  ) c ON c.vup_id = v.`id`
  SET v.`cost_price` = c.last_cost,
      v.`avg_cost` = c.avg_cost;

-- A delivery can be part-rejected; only the accepted units reach stock.
ALTER TABLE `purchase_receipt_items`
  ADD COLUMN `quantity_rejected` INTEGER NOT NULL DEFAULT 0 AFTER `quantity_received`,
  ADD COLUMN `rejection_reason` VARCHAR(255) NULL AFTER `quantity_rejected`;

-- Running tally per order line, so a line can never be over-returned.
ALTER TABLE `purchase_order_items`
  ADD COLUMN `quantity_returned` INTEGER NOT NULL DEFAULT 0 AFTER `quantity_received`;

-- Two movements the ledger had no way to express: stock going back to the
-- vendor, and stock written off in-house with no vendor claim.
ALTER TABLE `inventory_transactions`
  MODIFY COLUMN `movement_type`
    ENUM('PURCHASE','SALE','RETURN','REPLACEMENT','ADJUSTMENT','PURCHASE_RETURN','DAMAGE') NULL;

CREATE TABLE `purchase_returns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(64) NOT NULL,
  `return_number` VARCHAR(30) NOT NULL,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `vendor_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `return_date` DATE NULL,
  `debit_note_number` VARCHAR(60) NULL,
  `notes` VARCHAR(500) NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `completed_at` TIMESTAMP(0) NULL,
  `cancelled_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  UNIQUE INDEX `uq_pret_uuid`(`uuid`),
  UNIQUE INDEX `uq_pret_number`(`return_number`),
  INDEX `idx_pret_po`(`purchase_order_id`),
  INDEX `idx_pret_vendor`(`vendor_id`),
  INDEX `idx_pret_status`(`status`),
  INDEX `idx_pret_date`(`return_date`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pret_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pret_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_return_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_return_id` BIGINT UNSIGNED NOT NULL,
  `purchase_order_item_id` BIGINT UNSIGNED NOT NULL,
  `purchase_receipt_item_id` BIGINT UNSIGNED NULL,
  `variant_unit_price_id` BIGINT UNSIGNED NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `reason` ENUM('DAMAGED','WRONG_ITEM','EXPIRED','SHORT_SUPPLY','QUALITY','OTHER') NOT NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_preti_return`(`purchase_return_id`),
  INDEX `idx_preti_poi`(`purchase_order_item_id`),
  INDEX `idx_preti_ri`(`purchase_receipt_item_id`),
  INDEX `idx_preti_vup`(`variant_unit_price_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_preti_return` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_preti_poi` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_preti_ri` FOREIGN KEY (`purchase_receipt_item_id`) REFERENCES `purchase_receipt_items`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_preti_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
