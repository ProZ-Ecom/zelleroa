ALTER TABLE `styles`
  ADD COLUMN `is_new_arrival` BOOLEAN NOT NULL DEFAULT false AFTER `is_featured`,
  ADD COLUMN `new_arrival_until` DATE NULL AFTER `is_new_arrival`;
