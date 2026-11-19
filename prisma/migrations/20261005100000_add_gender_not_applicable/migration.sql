-- Adds 'na' (Not applicable) to products_gender for items with no audience (electronics etc.).
ALTER TABLE `products` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na') NULL;
ALTER TABLE `size_charts` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na') NOT NULL;
ALTER TABLE `header_menu_items` MODIFY `gender` ENUM('men', 'women', 'kids', 'unisex', 'na') NULL;
