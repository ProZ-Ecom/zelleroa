-- Renames the 'na' gender value to 'not_applicable' on products, size_charts and header_menu_items.
ALTER TABLE `products` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na', 'not_applicable') NULL;
ALTER TABLE `size_charts` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na', 'not_applicable') NOT NULL;
ALTER TABLE `header_menu_items` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na', 'not_applicable') NULL;

UPDATE `products` SET `gender` = 'not_applicable' WHERE `gender` = 'na';
UPDATE `size_charts` SET `gender` = 'not_applicable' WHERE `gender` = 'na';
UPDATE `header_menu_items` SET `gender` = 'not_applicable' WHERE `gender` = 'na';

ALTER TABLE `products` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'not_applicable') NULL;
ALTER TABLE `size_charts` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'not_applicable') NOT NULL;
ALTER TABLE `header_menu_items` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'not_applicable') NULL;
