-- A return raised for goods refused at the door covers units that never entered
-- stock, so completing it owes the vendor a debit note but must not move stock.
-- A return raised later, for goods already shelved, must. One flag per line
-- keeps both on the same document without the completion step having to guess.
ALTER TABLE `purchase_return_items`
  ADD COLUMN `affects_stock` BOOLEAN NOT NULL DEFAULT true AFTER `unit_cost`;
