-- Failed-login protection: attempt counter, progressive throttle and a temporary
-- lock. Independent of users.status / users.is_blocked (admin-controlled).
ALTER TABLE `users`
  ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `last_failed_login_at` DATETIME(3) NULL,
  ADD COLUMN `login_throttled_until` DATETIME(3) NULL,
  ADD COLUMN `login_locked_until` DATETIME(3) NULL;
