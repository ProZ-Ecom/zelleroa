-- AlterTable
ALTER TABLE `orders`
  ADD COLUMN `bank_account_holder` VARCHAR(150) NULL AFTER `notes`,
  ADD COLUMN `bank_name` VARCHAR(150) NULL AFTER `bank_account_holder`,
  ADD COLUMN `bank_account_number_enc` VARCHAR(500) NULL AFTER `bank_name`,
  ADD COLUMN `bank_account_last4` VARCHAR(4) NULL AFTER `bank_account_number_enc`,
  ADD COLUMN `bank_ifsc` VARCHAR(15) NULL AFTER `bank_account_last4`;

-- AlterTable
ALTER TABLE `customer_profiles`
  ADD COLUMN `bank_account_holder` VARCHAR(150) NULL AFTER `referred_by`,
  ADD COLUMN `bank_name` VARCHAR(150) NULL AFTER `bank_account_holder`,
  ADD COLUMN `bank_account_number_enc` VARCHAR(500) NULL AFTER `bank_name`,
  ADD COLUMN `bank_account_last4` VARCHAR(4) NULL AFTER `bank_account_number_enc`,
  ADD COLUMN `bank_ifsc` VARCHAR(15) NULL AFTER `bank_account_last4`;
