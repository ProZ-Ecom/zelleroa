-- Referral attribution is per ORDER, never per customer.
-- Adds the referral code + frozen commission summary to orders, the referral code to commissions,
-- and removes the permanent customer-agent tables.

ALTER TABLE `orders`
  ADD COLUMN `referral_code` VARCHAR(30) NULL,
  ADD COLUMN `commission_percentage` DECIMAL(5, 2) NULL,
  ADD COLUMN `commission_amount` DECIMAL(12, 2) NULL;

ALTER TABLE `commissions` ADD COLUMN `referral_code` VARCHAR(30) NULL;

CREATE INDEX `idx_orders_referral_code` ON `orders`(`referral_code`);
CREATE INDEX `idx_commissions_referral_code` ON `commissions`(`referral_code`);

-- Backfill existing agent orders from the credited agent (their code at the time is the best record we have).
UPDATE `orders` o
JOIN `users` a ON a.`id` = o.`agent_id`
LEFT JOIN `agent_profiles` p ON p.`user_id` = a.`id`
SET o.`referral_code` = COALESCE(a.`referral_code`, p.`agent_code`)
WHERE o.`agent_id` IS NOT NULL AND o.`referral_code` IS NULL;

UPDATE `commissions` c
JOIN `orders` o ON o.`id` = c.`order_id`
SET c.`referral_code` = o.`referral_code`
WHERE c.`referral_code` IS NULL;

UPDATE `orders` o
JOIN (
  SELECT `order_id`,
         SUM(`commission_amount`) AS amt,
         ROUND(SUM(`commission_amount`) * 100 / NULLIF(SUM(`product_amount`), 0), 2) AS pct
  FROM `commissions`
  GROUP BY `order_id`
) x ON x.`order_id` = o.`id`
SET o.`commission_amount` = x.amt, o.`commission_percentage` = x.pct;

-- Permanent customer -> agent mapping is gone.
DROP TABLE IF EXISTS `agent_referrals`;
DROP TABLE IF EXISTS `customer_agent_assignments`;
