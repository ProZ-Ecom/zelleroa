-- Vendors, purchase orders (with approval) and goods receipts feeding inventory.
CREATE TABLE `vendors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(64) NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `contact_person` VARCHAR(120) NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(150) NULL,
  `gstin` VARCHAR(20) NULL,
  `address` VARCHAR(500) NULL,
  `notes` VARCHAR(500) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` TIMESTAMP(0) NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  UNIQUE INDEX `uq_vendors_uuid`(`uuid`),
  UNIQUE INDEX `uq_vendors_code`(`code`),
  INDEX `idx_vendors_name`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(64) NOT NULL,
  `po_number` VARCHAR(30) NOT NULL,
  `vendor_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `expected_date` DATE NULL,
  `notes` VARCHAR(500) NULL,
  `reject_reason` VARCHAR(255) NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `submitted_at` TIMESTAMP(0) NULL,
  `approved_by` BIGINT UNSIGNED NULL,
  `approved_at` TIMESTAMP(0) NULL,
  `ordered_at` TIMESTAMP(0) NULL,
  `received_at` TIMESTAMP(0) NULL,
  `cancelled_at` TIMESTAMP(0) NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  UNIQUE INDEX `uq_po_uuid`(`uuid`),
  UNIQUE INDEX `uq_po_number`(`po_number`),
  INDEX `idx_po_vendor`(`vendor_id`),
  INDEX `idx_po_status`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_po_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `variant_unit_price_id` BIGINT UNSIGNED NOT NULL,
  `quantity_ordered` INTEGER NOT NULL,
  `quantity_received` INTEGER NOT NULL DEFAULT 0,
  `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_poi_po`(`purchase_order_id`),
  INDEX `idx_poi_vup`(`variant_unit_price_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_poi_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_receipts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `receipt_number` VARCHAR(30) NOT NULL,
  `received_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `notes` VARCHAR(500) NULL,
  `received_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uq_receipt_number`(`receipt_number`),
  INDEX `idx_receipt_po`(`purchase_order_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_receipt_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_receipt_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_id` BIGINT UNSIGNED NOT NULL,
  `purchase_order_item_id` BIGINT UNSIGNED NOT NULL,
  `variant_unit_price_id` BIGINT UNSIGNED NOT NULL,
  `quantity_received` INTEGER NOT NULL,
  `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  INDEX `idx_ri_receipt`(`receipt_id`),
  INDEX `idx_ri_poi`(`purchase_order_item_id`),
  INDEX `idx_ri_vup`(`variant_unit_price_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `purchase_receipts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_ri_poi` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ri_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_order_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id` BIGINT UNSIGNED NOT NULL,
  `from_status` VARCHAR(30) NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `note` VARCHAR(255) NULL,
  `changed_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  INDEX `idx_poh_po`(`purchase_order_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_poh_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
