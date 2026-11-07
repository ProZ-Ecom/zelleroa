-- A stock row can now carry any number of variation attributes, not just one.
--
-- variant_unit_prices.attribute_value_id is a single FK, so a product with Colour +
-- Size + Neck had nowhere to put Neck: generation recorded only the first non-colour
-- value and silently skipped every combination that repeated it. Variation values move
-- into their own table (mirroring variant_attribute_values one level down), with a
-- canonical signature column carrying uniqueness. attribute_value_id stays as the
-- primary value, so labels, size charts and existing reads keep working.

-- Every SKU-axis value of a stock row, one row per attribute.
CREATE TABLE `variant_unit_price_attribute_values` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `variant_unit_price_id` BIGINT UNSIGNED NOT NULL,
  `attribute_id` BIGINT UNSIGNED NOT NULL,
  `attribute_value_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  UNIQUE INDEX `uniq_vupav_vup_attribute`(`variant_unit_price_id`, `attribute_id`),
  INDEX `fk_vupav_attribute`(`attribute_id`),
  INDEX `fk_vupav_value`(`attribute_value_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_vupav_vup` FOREIGN KEY (`variant_unit_price_id`) REFERENCES `variant_unit_prices`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_vupav_attribute` FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_vupav_value` FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The row's variation values, sorted ascending and joined with "-". Empty string and
-- not null: MySQL counts nulls as distinct in a unique index, which would let duplicate
-- no-attribute rows through.
ALTER TABLE `variant_unit_prices`
  ADD COLUMN `attribute_signature` VARCHAR(255) NOT NULL DEFAULT '' AFTER `attribute_value_id`;

-- Which attributes split stock, per product. Defaults to SKU for anything added later.
ALTER TABLE `product_attribute_configs`
  ADD COLUMN `variation_level` ENUM('VARIANT','SKU','INFO') NOT NULL DEFAULT 'SKU' AFTER `sort_order`;

-- Carry each existing row's one value over, archived rows included: an archived row
-- keeps its data readable, and keeps reserving its signature for the revive-on-conflict
-- path in variant-unit-price.repository.ts.
INSERT INTO `variant_unit_price_attribute_values`
  (`variant_unit_price_id`, `attribute_id`, `attribute_value_id`)
SELECT v.`id`, av.`attribute_id`, v.`attribute_value_id`
FROM `variant_unit_prices` v
  JOIN `attribute_values` av ON av.`id` = v.`attribute_value_id`
WHERE v.`attribute_value_id` IS NOT NULL;

UPDATE `variant_unit_prices`
  SET `attribute_signature` = COALESCE(CAST(`attribute_value_id` AS CHAR), '');

-- Backfill variation_level so today's behaviour is preserved exactly rather than
-- improved by surprise. An attribute that is configured but absent from every stock row
-- is being ignored right now, so it becomes INFO: promoting it to SKU would otherwise
-- multiply the SKU set the first time someone regenerates.
UPDATE `product_attribute_configs` SET `variation_level` = 'INFO';

UPDATE `product_attribute_configs` pac
  JOIN `attribute_values` av ON av.`attribute_id` = pac.`attribute_id`
  JOIN `variant_unit_prices` vup ON vup.`attribute_value_id` = av.`id`
  JOIN `product_variants` pv ON pv.`id` = vup.`variant_id`
  JOIN `items` i ON i.`id` = pv.`item_id`
  JOIN `styles` s ON s.`id` = i.`style_id` AND s.`product_id` = pac.`product_id`
  SET pac.`variation_level` = 'SKU';

-- Colour is the axis that owns images, so it stays at variant level. Matched on name as
-- well as type because the catalog holds both "Colour" (type color) and "Color" (text).
UPDATE `product_attribute_configs` pac
  JOIN `product_attributes` pa ON pa.`id` = pac.`attribute_id`
  SET pac.`variation_level` = 'VARIANT'
WHERE pa.`type` = 'color' OR LOWER(pa.`name`) IN ('color', 'colour');

-- uniq_vup_variant_size keyed (variant, value), which cannot express a multi-attribute
-- row and also blocked selling one size in two units. unit_value joins the key for the
-- pack-size flow, where 250g/500g share a variant and a unit.
-- The FK indexes fk_vup_variant and fk_vup_size_value stay, so dropping this is safe.
ALTER TABLE `variant_unit_prices`
  DROP INDEX `uniq_vup_variant_size`,
  ADD UNIQUE INDEX `uniq_vup_variant_signature`(`variant_id`, `unit_id`, `unit_value`, `attribute_signature`);
