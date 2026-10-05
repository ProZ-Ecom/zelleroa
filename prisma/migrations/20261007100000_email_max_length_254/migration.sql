-- Widen email columns from 150 to 254 chars (RFC 5321 max) to match the shared email validation.
ALTER TABLE `users` MODIFY `email` VARCHAR(254) NULL;
ALTER TABLE `companies` MODIFY `email` VARCHAR(254) NULL;
ALTER TABLE `bulk_order_enquiries` MODIFY `email` VARCHAR(254) NOT NULL;
ALTER TABLE `contact_messages` MODIFY `email` VARCHAR(254) NOT NULL;
ALTER TABLE `newsletter_subscribers` MODIFY `email` VARCHAR(254) NOT NULL;
ALTER TABLE `vendors` MODIFY `email` VARCHAR(254) NULL;
