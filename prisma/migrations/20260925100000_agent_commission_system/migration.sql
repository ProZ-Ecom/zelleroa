-- Agent referral & commission system: agents stay as users(role=AGENT); this adds the
-- profile, assignment history, referral log, rate config, commission ledger, payouts and audit trail.

-- CreateTable
CREATE TABLE `agent_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agent_code` VARCHAR(20) NOT NULL,
    `notes` VARCHAR(500) NULL,
    `preferred_payout_method` ENUM('upi', 'bank_transfer') NULL,
    `upi_id` VARCHAR(100) NULL,
    `bank_account_holder` VARCHAR(150) NULL,
    `bank_name` VARCHAR(150) NULL,
    `bank_account_number_enc` VARCHAR(500) NULL,
    `bank_account_last4` VARCHAR(4) NULL,
    `bank_ifsc` VARCHAR(15) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,

    UNIQUE INDEX `uq_agent_profiles_user`(`user_id`),
    UNIQUE INDEX `uq_agent_profiles_code`(`agent_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_agent_assignments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(64) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `active_customer_id` BIGINT UNSIGNED NULL,
    `source` ENUM('referral_link', 'order', 'admin', 'customer_change') NOT NULL,
    `referral_code` VARCHAR(30) NULL,
    `assigned_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ended_at` TIMESTAMP(0) NULL,
    `end_reason` VARCHAR(255) NULL,
    `assigned_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_caa_uuid`(`uuid`),
    UNIQUE INDEX `uq_caa_active_customer`(`active_customer_id`),
    INDEX `idx_caa_agent`(`agent_id`, `ended_at`),
    INDEX `idx_caa_customer`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_referrals` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `referral_code` VARCHAR(30) NOT NULL,
    `trigger` VARCHAR(30) NOT NULL,
    `outcome` VARCHAR(30) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_agent_referrals_agent`(`agent_id`),
    INDEX `idx_agent_referrals_customer`(`customer_id`),
    INDEX `idx_agent_referrals_code`(`referral_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_rates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `scope` ENUM('global', 'category', 'product') NOT NULL,
    `scope_key` VARCHAR(40) NOT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `product_id` BIGINT UNSIGNED NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by` BIGINT UNSIGNED NULL,
    `updated_by` BIGINT UNSIGNED NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_commission_rates_scope_key`(`scope_key`),
    INDEX `idx_commission_rates_scope`(`scope`, `is_active`),
    INDEX `idx_commission_rates_category`(`category_id`),
    INDEX `idx_commission_rates_product`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(64) NOT NULL,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `order_item_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NULL,
    `product_amount` DECIMAL(12, 2) NOT NULL,
    `commission_percentage` DECIMAL(5, 2) NOT NULL,
    `rate_source` VARCHAR(20) NOT NULL,
    `commission_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'approved', 'payout_requested', 'payout_approved', 'paid', 'cancelled', 'reversed') NOT NULL DEFAULT 'pending',
    `order_status` VARCHAR(30) NOT NULL,
    `delivered_at` TIMESTAMP(0) NULL,
    `return_period_ends_at` TIMESTAMP(0) NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `payout_id` BIGINT UNSIGNED NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `cancelled_at` TIMESTAMP(0) NULL,
    `reversed_at` TIMESTAMP(0) NULL,
    `reversal_reason` VARCHAR(255) NULL,
    `clawback_due` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_commissions_uuid`(`uuid`),
    UNIQUE INDEX `uq_commissions_order_item`(`order_item_id`),
    INDEX `idx_commissions_agent_status`(`agent_id`, `status`),
    INDEX `idx_commissions_customer`(`customer_id`),
    INDEX `idx_commissions_order`(`order_id`),
    INDEX `idx_commissions_product`(`product_id`),
    INDEX `idx_commissions_category`(`category_id`),
    INDEX `idx_commissions_payout`(`payout_id`),
    INDEX `idx_commissions_status_due`(`status`, `return_period_ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_payouts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(64) NOT NULL,
    `agent_id` BIGINT UNSIGNED NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('upi', 'bank_transfer') NOT NULL,
    `upi_id` VARCHAR(100) NULL,
    `account_holder_name` VARCHAR(150) NULL,
    `bank_name` VARCHAR(150) NULL,
    `account_number_enc` VARCHAR(500) NULL,
    `account_last4` VARCHAR(4) NULL,
    `ifsc` VARCHAR(15) NULL,
    `status` ENUM('requested', 'approved', 'rejected', 'paid', 'cancelled') NOT NULL DEFAULT 'requested',
    `requested_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `reviewed_at` TIMESTAMP(0) NULL,
    `reviewed_by` BIGINT UNSIGNED NULL,
    `rejection_reason` VARCHAR(255) NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `paid_by` BIGINT UNSIGNED NULL,
    `transaction_reference` VARCHAR(100) NULL,
    `admin_note` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_commission_payouts_uuid`(`uuid`),
    INDEX `idx_commission_payouts_agent_status`(`agent_id`, `status`),
    INDEX `idx_commission_payouts_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `entity_type` VARCHAR(30) NOT NULL,
    `entity_id` BIGINT UNSIGNED NOT NULL,
    `agent_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(50) NOT NULL,
    `from_status` VARCHAR(30) NULL,
    `to_status` VARCHAR(30) NULL,
    `actor_id` BIGINT UNSIGNED NULL,
    `actor_role` VARCHAR(20) NULL,
    `note` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cal_entity`(`entity_type`, `entity_id`),
    INDEX `idx_cal_agent`(`agent_id`),
    INDEX `idx_cal_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agent_profiles` ADD CONSTRAINT `fk_agent_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_agent_assignments` ADD CONSTRAINT `fk_caa_customer` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_agent_assignments` ADD CONSTRAINT `fk_caa_agent` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `agent_referrals` ADD CONSTRAINT `fk_agent_referrals_agent` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `agent_referrals` ADD CONSTRAINT `fk_agent_referrals_customer` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commission_rates` ADD CONSTRAINT `fk_commission_rates_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commission_rates` ADD CONSTRAINT `fk_commission_rates_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_agent` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_customer` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_category` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commissions` ADD CONSTRAINT `fk_commissions_payout` FOREIGN KEY (`payout_id`) REFERENCES `commission_payouts`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `commission_payouts` ADD CONSTRAINT `fk_commission_payouts_agent` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Seed: AGENT role (the app seed script normally creates it, but existing databases predate it)
INSERT INTO `roles` (`name`, `slug`, `description`)
SELECT 'AGENT', 'agent', 'Referral agent credited for attributed signups and orders'
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `slug` = 'agent');

-- Seed: how many days after delivery a commission stays pending (matches the 3-day return policy)
INSERT INTO `settings` (`key_name`, `value`, `type`)
SELECT 'agent_commission_return_period_days', '3', 'number'
WHERE NOT EXISTS (SELECT 1 FROM `settings` WHERE `key_name` = 'agent_commission_return_period_days');

-- Backfill: customers who signed up through an agent link become active assignments
INSERT INTO `customer_agent_assignments`
  (`uuid`, `customer_id`, `agent_id`, `active_customer_id`, `source`, `assigned_at`)
SELECT UUID(), u.`id`, u.`referred_by_agent_id`, u.`id`, 'referral_link', COALESCE(u.`referred_at`, u.`created_at`)
FROM `users` u
WHERE u.`referred_by_agent_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `customer_agent_assignments` a WHERE a.`customer_id` = u.`id`);
