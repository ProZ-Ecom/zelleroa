-- AlterTable
ALTER TABLE `styles` ADD COLUMN `brand_id` BIGINT UNSIGNED NULL;

-- CreateIndex
CREATE INDEX `idx_styles_brand` ON `styles`(`brand_id`);

-- AddForeignKey
ALTER TABLE `styles` ADD CONSTRAINT `fk_styles_brand` FOREIGN KEY (`brand_id`) REFERENCES `product_brands`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Backfill: existing Items inherit their Product's brand so none start blank.
UPDATE `styles` s
  JOIN `products` p ON p.`id` = s.`product_id`
  SET s.`brand_id` = p.`brand_id`
  WHERE s.`brand_id` IS NULL AND p.`brand_id` IS NOT NULL;
