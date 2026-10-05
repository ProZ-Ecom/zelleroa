ALTER TABLE `banners`
  ADD COLUMN `offer_id` BIGINT UNSIGNED NULL AFTER `link_url`,
  ADD INDEX `fk_banners_offer` (`offer_id`),
  ADD CONSTRAINT `fk_banners_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
