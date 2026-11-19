-- Same gap the return flow had: the unit coming back from the customer was
-- always credited to the SKU on the order line, so a "wrong product" or
-- mis-picked replacement overstated the ordered SKU and never counted the one
-- actually in our hands. NULL keeps the old meaning of "what they ordered".
ALTER TABLE `replacement_request_items`
  ADD COLUMN `received_variant_unit_price_id` BIGINT UNSIGNED NULL AFTER `order_item_id`,
  ADD INDEX `fk_replitem_received_vup` (`received_variant_unit_price_id`),
  ADD CONSTRAINT `fk_replitem_received_vup`
    FOREIGN KEY (`received_variant_unit_price_id`) REFERENCES `variant_unit_prices` (`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;
