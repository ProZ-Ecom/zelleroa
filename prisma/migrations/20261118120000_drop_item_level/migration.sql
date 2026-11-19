-- Removes the admin-only Item level between Style and ProductVariant.
-- New chain: Product -> Style -> ProductVariant (Color) -> VariantUnitPrice (Size/SKU).
--
-- Variants and the attribute-value pool move up onto the Style they already
-- belonged to through their Item. The extra `item_id` column on
-- cart/order/wishlist rows goes away - those tables already carry `style_id`,
-- which is what the app reads.

-- ---------------------------------------------------------------------------
-- 0. Orphan tree: items whose style_id points at no Style (style_id = 0 test
--    rows) have no Style to move to, and nothing in orders, purchases or
--    returns references them, so they are deleted with everything under them.
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE `_orphan_items` (`id` BIGINT UNSIGNED PRIMARY KEY);
INSERT INTO `_orphan_items` SELECT i.`id` FROM `items` i LEFT JOIN `styles` s ON i.`style_id` = s.`id` WHERE s.`id` IS NULL;

CREATE TEMPORARY TABLE `_orphan_variants` (`id` BIGINT UNSIGNED PRIMARY KEY);
INSERT INTO `_orphan_variants` SELECT v.`id` FROM `product_variants` v WHERE v.`item_id` IN (SELECT `id` FROM `_orphan_items`);

CREATE TEMPORARY TABLE `_orphan_vups` (`id` BIGINT UNSIGNED PRIMARY KEY);
INSERT INTO `_orphan_vups` SELECT u.`id` FROM `variant_unit_prices` u WHERE u.`variant_id` IN (SELECT `id` FROM `_orphan_variants`);

DELETE FROM `variant_unit_price_attribute_values` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `inventory_transactions` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `inventory_reservations` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `inventories` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `stock_adjustments` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `stock_reports` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `variant_price_history` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `offer_items` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `combo_product_items` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `cart_items` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `cart_items` WHERE `variant_id` IN (SELECT `id` FROM `_orphan_variants`);
DELETE FROM `wishlist_items` WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `wishlist_items` WHERE `variant_id` IN (SELECT `id` FROM `_orphan_variants`);
UPDATE `reviews` SET `variant_unit_price_id` = NULL WHERE `variant_unit_price_id` IN (SELECT `id` FROM `_orphan_vups`);

DELETE FROM `variant_unit_prices` WHERE `id` IN (SELECT `id` FROM `_orphan_vups`);
DELETE FROM `variant_attribute_values` WHERE `variant_id` IN (SELECT `id` FROM `_orphan_variants`);
DELETE FROM `product_variant_images` WHERE `variant_id` IN (SELECT `id` FROM `_orphan_variants`);
DELETE FROM `product_variants` WHERE `id` IN (SELECT `id` FROM `_orphan_variants`);

DELETE FROM `item_attribute_values` WHERE `item_id` IN (SELECT `id` FROM `_orphan_items`);
UPDATE `cart_items` SET `item_id` = NULL WHERE `item_id` IN (SELECT `id` FROM `_orphan_items`);
UPDATE `order_items` SET `item_id` = NULL WHERE `item_id` IN (SELECT `id` FROM `_orphan_items`);
UPDATE `wishlist_items` SET `item_id` = NULL WHERE `item_id` IN (SELECT `id` FROM `_orphan_items`);
DELETE FROM `items` WHERE `id` IN (SELECT `id` FROM `_orphan_items`);

-- ---------------------------------------------------------------------------
-- 1. ProductVariant now hangs off the Style directly.
-- ---------------------------------------------------------------------------
ALTER TABLE `product_variants` DROP FOREIGN KEY `fk_variant_item`;
UPDATE `product_variants` v JOIN `items` i ON v.`item_id` = i.`id` SET v.`item_id` = i.`style_id`;
ALTER TABLE `product_variants` DROP INDEX `idx_variant_item`;
ALTER TABLE `product_variants` CHANGE COLUMN `item_id` `style_id` BIGINT UNSIGNED NOT NULL;
CREATE INDEX `idx_variant_style` ON `product_variants`(`style_id`);
ALTER TABLE `product_variants` ADD CONSTRAINT `fk_variant_style` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------
-- 2. The attribute-value pool moves from the Item onto the Style.
--    Two Items under one Style could hold the same value - keep the first.
-- ---------------------------------------------------------------------------
ALTER TABLE `item_attribute_values` DROP FOREIGN KEY `fk_iav_item`;
ALTER TABLE `item_attribute_values` DROP INDEX `uniq_item_attribute_value`;
ALTER TABLE `item_attribute_values` DROP INDEX `fk_iav_item`;
UPDATE `item_attribute_values` iav JOIN `items` i ON iav.`item_id` = i.`id` SET iav.`item_id` = i.`style_id`;
ALTER TABLE `item_attribute_values` CHANGE COLUMN `item_id` `style_id` BIGINT UNSIGNED NOT NULL;
DELETE a FROM `item_attribute_values` a
  JOIN `item_attribute_values` b
    ON a.`style_id` = b.`style_id`
   AND a.`attribute_value_id` = b.`attribute_value_id`
   AND a.`id` > b.`id`;
CREATE UNIQUE INDEX `uniq_style_attribute_value` ON `item_attribute_values`(`style_id`, `attribute_value_id`);
CREATE INDEX `fk_sav_style` ON `item_attribute_values`(`style_id`);
ALTER TABLE `item_attribute_values` ADD CONSTRAINT `fk_sav_style` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
RENAME TABLE `item_attribute_values` TO `style_attribute_values`;

-- ---------------------------------------------------------------------------
-- 3. cart / order / wishlist lose the spare item_id column. style_id stays and
--    keeps its index under the name the schema declares for it.
-- ---------------------------------------------------------------------------
ALTER TABLE `cart_items` DROP FOREIGN KEY `fk_cartitem_newitem`;
ALTER TABLE `cart_items` DROP COLUMN `item_id`;
CREATE INDEX `fk_cartitem_item` ON `cart_items`(`style_id`);

ALTER TABLE `order_items` DROP FOREIGN KEY `fk_orderitem_newitem`;
ALTER TABLE `order_items` DROP COLUMN `item_id`;
CREATE INDEX `fk_orderitem_item` ON `order_items`(`style_id`);

ALTER TABLE `wishlist_items` DROP FOREIGN KEY `fk_wishlist_newitem`;
ALTER TABLE `wishlist_items` DROP COLUMN `item_id`;
CREATE INDEX `fk_wishlist_item` ON `wishlist_items`(`style_id`);

-- ---------------------------------------------------------------------------
-- 4. The Item level itself is gone.
-- ---------------------------------------------------------------------------
DROP TABLE `items`;
