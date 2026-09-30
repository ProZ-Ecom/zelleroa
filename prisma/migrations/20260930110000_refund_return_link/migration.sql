-- Links a refund to the return request that caused it (NULL for cancellation / manual refunds).
ALTER TABLE `refunds` ADD COLUMN `return_request_id` BIGINT UNSIGNED NULL;
CREATE INDEX `idx_refund_return_request` ON `refunds`(`return_request_id`);
ALTER TABLE `refunds`
  ADD CONSTRAINT `fk_refund_return_request` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
