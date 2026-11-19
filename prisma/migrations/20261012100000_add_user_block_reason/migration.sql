-- Mandatory reason recorded when an admin blocks a customer or sales partner.
ALTER TABLE `users`
  ADD COLUMN `block_reason` VARCHAR(500) NULL;
