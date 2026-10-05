-- product_variants hangs off items (item_id) now. The pre-rename product_id column
-- was left behind as NOT NULL with no default, so every new color insert failed
-- with a null constraint violation (P2011).
ALTER TABLE `product_variants` DROP FOREIGN KEY `fk_variant_product`;
ALTER TABLE `product_variants` DROP INDEX `idx_variant_product`;
ALTER TABLE `product_variants` DROP COLUMN `product_id`;
