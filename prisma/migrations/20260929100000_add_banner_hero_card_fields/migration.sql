ALTER TABLE `banners`
  ADD COLUMN `badge_label` VARCHAR(50) NULL AFTER `link_url`,
  ADD COLUMN `subtitle` VARCHAR(100) NULL AFTER `badge_label`,
  ADD COLUMN `price_text` VARCHAR(50) NULL AFTER `subtitle`;
