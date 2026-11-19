-- Roles get an explicit area ("scope") so admin access no longer depends on the role NAME.
-- Existing rows keep working: the four seeded roles are mapped by slug, anything else
-- stays CUSTOMER (the safe default) and an admin can promote it from the Roles screen.
ALTER TABLE `roles`
  ADD COLUMN `scope` VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';

UPDATE `roles` SET `scope` = 'ADMIN'    WHERE LOWER(`slug`) IN ('admin', 'super-admin', 'super_admin', 'staff');
UPDATE `roles` SET `scope` = 'AGENT'    WHERE LOWER(`slug`) = 'agent';
UPDATE `roles` SET `scope` = 'CUSTOMER' WHERE LOWER(`slug`) = 'customer';
