-- 1) Add columns as nullable first
ALTER TABLE "BankDetails" ADD COLUMN "branchName" TEXT;
ALTER TABLE "FarmerBank" ADD COLUMN "branchName" TEXT;

-- 2) Backfill existing rows
UPDATE "BankDetails"
SET "branchName" = 'Main Branch'
WHERE "branchName" IS NULL;

UPDATE "FarmerBank"
SET "branchName" = 'Main Branch'
WHERE "branchName" IS NULL;

-- 3) Enforce NOT NULL after data is populated
ALTER TABLE "BankDetails"
ALTER COLUMN "branchName" SET NOT NULL;

ALTER TABLE "FarmerBank"
ALTER COLUMN "branchName" SET NOT NULL;
