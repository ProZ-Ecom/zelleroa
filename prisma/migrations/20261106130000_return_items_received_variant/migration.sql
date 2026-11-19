-- "Wrong product received" is one of the return reasons, but nothing recorded
-- WHICH product actually turned up: restocking credited the SKU the customer
-- ordered, so the ordered SKU was overstated and the one in our hands was
-- never counted. This column holds the SKU that physically arrived, set at
-- quality check; NULL keeps the old meaning of "the item they ordered".
ALTER TABLE `return_items`
  ADD COLUMN `received_variant_unit_price_id` BIGINT UNSIGNED NULL AFTER `order_item_id`,
  ADD INDEX `fk_returnitem_received_vup` (`received_variant_unit_price_id`),
  ADD CONSTRAINT `fk_returnitem_received_vup`
    FOREIGN KEY (`received_variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;
