-- Margin on a past sale has to use what the goods cost on the day they were
-- sold, not what they cost now. Orders placed before this column exists keep
-- NULL, and the margin report falls back to the SKU's current cost for them.
ALTER TABLE `order_items` ADD COLUMN `unit_cost` DECIMAL(10,2) NULL AFTER `unit_price`;
