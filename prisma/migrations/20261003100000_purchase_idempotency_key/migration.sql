-- One-step "Confirm Purchase": a client-generated key makes re-submitting the
-- same purchase return the original instead of adding stock twice.
ALTER TABLE `purchase_orders`
  ADD COLUMN `idempotency_key` VARCHAR(64) NULL,
  ADD UNIQUE INDEX `uq_po_idempotency_key`(`idempotency_key`);
