-- Stock movement ledger: every stock change records its type, the before/after
-- stock level and a source reference. Purchases gain invoice, date and charges.
ALTER TABLE `inventory_transactions`
  ADD COLUMN `movement_type` ENUM('PURCHASE','SALE','RETURN','REPLACEMENT','ADJUSTMENT') NULL,
  ADD COLUMN `previous_stock` INT NULL,
  ADD COLUMN `new_stock` INT NULL,
  ADD COLUMN `reference_number` VARCHAR(60) NULL,
  ADD INDEX `idx_invtx_movement_type`(`movement_type`, `created_at`),
  ADD INDEX `idx_invtx_created`(`created_at`);

-- Classify history written before the ledger existed from its reference.
UPDATE `inventory_transactions` SET `movement_type` = CASE
  WHEN `reference_type` = 'purchase_receipt' THEN 'PURCHASE'
  WHEN `reference_type` = 'order' THEN 'SALE'
  WHEN `reference_type` IN ('order_cancel','order_return') THEN 'RETURN'
  WHEN `reference_type` = 'order_replacement' THEN 'REPLACEMENT'
  ELSE 'ADJUSTMENT' END
WHERE `movement_type` IS NULL AND `type` IN ('in','out');

ALTER TABLE `purchase_orders`
  ADD COLUMN `purchase_date` DATE NULL AFTER `expected_date`,
  ADD COLUMN `invoice_number` VARCHAR(60) NULL AFTER `purchase_date`,
  ADD COLUMN `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `reject_reason`,
  ADD COLUMN `additional_charges` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `subtotal`,
  ADD INDEX `idx_po_purchase_date`(`purchase_date`);

UPDATE `purchase_orders` SET `subtotal` = `total_amount`, `purchase_date` = DATE(`created_at`);
