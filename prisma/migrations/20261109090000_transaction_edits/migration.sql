-- Track edits made to posted transactions
ALTER TABLE "Transaction" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "editedBy" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0;
