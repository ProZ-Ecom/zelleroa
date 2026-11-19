-- Header menu items can now point at product tags (alongside categories).
CREATE TABLE `header_menu_item_tags` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `header_menu_item_id` BIGINT UNSIGNED NOT NULL,
    `tag_id` BIGINT UNSIGNED NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_hmit_tag`(`tag_id`),
    UNIQUE INDEX `uq_hmit_item_tag`(`header_menu_item_id`, `tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `header_menu_item_tags` ADD CONSTRAINT `fk_hmit_item` FOREIGN KEY (`header_menu_item_id`) REFERENCES `header_menu_items`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `header_menu_item_tags` ADD CONSTRAINT `fk_hmit_tag` FOREIGN KEY (`tag_id`) REFERENCES `product_tags`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
