-- Returns move from an admin-scheduled pickup to the customer shipping the item
-- back with any courier, plus the exception statuses the timeline needs.

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
    'refund_pending',
    'refunded',
    'expired',
    'cancelled',
    'closed'
  ) NOT NULL DEFAULT 'return_requested';

-- AlterTable
ALTER TABLE `return_requests`
  ADD COLUMN `ship_deadline_at` TIMESTAMP NULL AFTER `pickup_scheduled_at`,
  ADD COLUMN `shipped_at` TIMESTAMP NULL AFTER `ship_deadline_at`,
  ADD COLUMN `received_at` TIMESTAMP NULL AFTER `pickup_image_url`,
  ADD COLUMN `qc_failed_at` TIMESTAMP NULL AFTER `received_at`,
  ADD COLUMN `qc_failure_reason` VARCHAR(500) NULL AFTER `qc_failed_at`,
  ADD COLUMN `expired_at` TIMESTAMP NULL AFTER `qc_failure_reason`,
  ADD COLUMN `cancelled_at` TIMESTAMP NULL AFTER `expired_at`,
  ADD COLUMN `cancelled_by` BIGINT UNSIGNED NULL AFTER `cancelled_at`,
  ADD COLUMN `cancellation_reason` VARCHAR(500) NULL AFTER `cancelled_by`;

-- Existing pickup-based returns keep their history; map the in-flight ones onto
-- the step that now stands for "the item is on its way back to us".
UPDATE `return_requests`
   SET `status` = 'shipped_by_customer',
       `shipped_at` = COALESCE(`pickup_scheduled_at`, `updated_at`)
 WHERE `status` IN ('pickup_scheduled', 'picked_up');

-- Requests already past QC have their received timestamp inferred from history.
UPDATE `return_requests` r
   SET r.`received_at` = COALESCE(
         (SELECT MIN(h.`created_at`)
            FROM `return_request_history` h
           WHERE h.`return_request_id` = r.`id`
             AND h.`to_status` = 'received'),
         r.`updated_at`
       )
 WHERE r.`status` IN ('received', 'refund_pending', 'refunded')
   AND r.`received_at` IS NULL;
