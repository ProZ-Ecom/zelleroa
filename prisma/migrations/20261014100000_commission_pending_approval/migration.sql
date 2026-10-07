-- Return period completed -> awaiting admin approval before the commission becomes payable.
ALTER TABLE `commissions`
  MODIFY COLUMN `status` ENUM('pending', 'pending_approval', 'approved', 'payout_requested', 'payout_approved', 'paid', 'cancelled', 'reversed') NOT NULL DEFAULT 'pending';
