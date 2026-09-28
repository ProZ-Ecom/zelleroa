-- Referral attribution is per order; the permanent customer -> agent column is removed.
ALTER TABLE `users` DROP FOREIGN KEY `fk_users_referred_by_agent`;
DROP INDEX `fk_users_referred_by_agent` ON `users`;
ALTER TABLE `users` DROP COLUMN `referred_by_agent_id`;
