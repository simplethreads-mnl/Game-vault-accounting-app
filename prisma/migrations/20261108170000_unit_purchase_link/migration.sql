-- Link each inventory unit to the purchase that created it (multi-quantity and free purchases)
ALTER TABLE "InventoryUnit" ADD COLUMN "purchaseTransactionId" TEXT;
CREATE INDEX "InventoryUnit_purchaseTransactionId_idx" ON "InventoryUnit"("purchaseTransactionId");
-- Backfill existing single-unit purchases
UPDATE "InventoryUnit" u SET "purchaseTransactionId" = t."id" FROM "Transaction" t
  WHERE t."type" = 'PURCHASE' AND t."unitId" = u."id" AND u."purchaseTransactionId" IS NULL;
