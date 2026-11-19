-- A failed quality check means the item belongs to the customer and has to go
-- back to them. Until now that leg was invisible: the request stopped at
-- `qc_failed` and the courier details lived outside the system.

-- AlterEnum
ALTER TABLE `return_requests`
  MODIFY `status` ENUM(
    'return_requested',
    'under_review',
    'approved',
    'rejected',
    'pickup_scheduled',
    'picked_up',
    'shipped_by_customer',
    'received',
    'qc_failed',
    'returning_to_customer',
    'returned_to_customer',
    'refund_pending',
    'refunded',
    'expired',
    'cancelled',
    'closed'
  ) NOT NULL DEFAULT 'return_requested';

-- AlterTable
-- Deliberately separate from `courier_name` / `tracking_number`, which hold the
-- customer's own courier on the way in; overwriting those would lose the proof
-- that the parcel ever reached us.
ALTER TABLE `return_requests`
  ADD COLUMN `sendback_courier_name` VARCHAR(100) NULL AFTER `qc_failure_reason`,
  ADD COLUMN `sendback_tracking_number` VARCHAR(100) NULL AFTER `sendback_courier_name`,
  ADD COLUMN `sendback_shipped_at` TIMESTAMP NULL AFTER `sendback_tracking_number`,
  ADD COLUMN `sendback_proof_url` VARCHAR(500) NULL AFTER `sendback_shipped_at`,
  ADD COLUMN `sendback_delivered_at` TIMESTAMP NULL AFTER `sendback_proof_url`;
