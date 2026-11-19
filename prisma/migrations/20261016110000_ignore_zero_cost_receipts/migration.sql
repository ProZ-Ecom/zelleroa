-- Opening stock typed in at item creation is received at unit_cost 0 because no
-- cost is known then. The previous backfill read that as "this SKU costs zero",
-- which would value that stock at nothing. Cost unknown is NULL, not 0, so
-- recompute over priced receipt lines only and leave the rest NULL.
-- A genuinely free receipt (a sample) also lands as NULL; that is intended.

UPDATE `variant_unit_prices` SET `cost_price` = NULL, `avg_cost` = NULL;

UPDATE `variant_unit_prices` v
  JOIN (
    SELECT ri.`variant_unit_price_id` AS vup_id,
           SUM(ri.`quantity_received` * ri.`unit_cost`) / NULLIF(SUM(ri.`quantity_received`), 0) AS avg_cost,
           SUBSTRING_INDEX(
             GROUP_CONCAT(ri.`unit_cost` ORDER BY ri.`id` DESC SEPARATOR ','), ',', 1
           ) + 0 AS last_cost
    FROM `purchase_receipt_items` ri
    WHERE ri.`unit_cost` > 0 AND ri.`quantity_received` > 0
    GROUP BY ri.`variant_unit_price_id`
  ) c ON c.vup_id = v.`id`
  SET v.`cost_price` = c.last_cost,
      v.`avg_cost` = c.avg_cost;
