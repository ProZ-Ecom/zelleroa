-- Header menu tables were present in schema.prisma and the backups but never had a migration.
CREATE TABLE IF NOT EXISTS `header_menu_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NULL DEFAULT 'UUID()',
  `label` VARCHAR(150) NOT NULL,
  `link` VARCHAR(500) NULL,
  `gender` ENUM('men', 'women', 'kids', 'unisex') NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `deleted_at` TIMESTAMP(0) NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,

  INDEX `fk_header_menu_created_by`(`created_by`),
  INDEX `fk_header_menu_updated_by`(`updated_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `header_menu_item_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `header_menu_item_id` BIGINT UNSIGNED NOT NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  INDEX `fk_hmic_category`(`category_id`),
  UNIQUE INDEX `uq_hmic_item_category`(`header_menu_item_id`, `category_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `header_menu_items` ADD CONSTRAINT `fk_header_menu_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `header_menu_items` ADD CONSTRAINT `fk_header_menu_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `header_menu_item_categories` ADD CONSTRAINT `fk_hmic_item` FOREIGN KEY (`header_menu_item_id`) REFERENCES `header_menu_items`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `header_menu_item_categories` ADD CONSTRAINT `fk_hmic_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
