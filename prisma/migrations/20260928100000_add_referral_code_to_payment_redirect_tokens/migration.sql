-- The Razorpay redirect checkout hands off to a separate payment app, which calls
-- back server-to-server with no access to the customer's browser cookies. The
-- referral code active at redirect-initiation time must be carried on the
-- one-time token itself so order creation (at verify time) can still attribute it.
ALTER TABLE `payment_redirect_tokens`
  ADD COLUMN `referral_code` VARCHAR(30) NULL AFTER `notes`;
