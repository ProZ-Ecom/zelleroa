-- Proof the customer actually posted the parcel: mandatory when shipping
-- details are entered.

-- AlterTable
ALTER TABLE `return_requests`
  ADD COLUMN `shipping_slip_url` VARCHAR(500) NULL AFTER `tracking_number`;
