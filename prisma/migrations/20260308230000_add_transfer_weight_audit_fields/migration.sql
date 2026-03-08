ALTER TABLE "StockTransfer"
ADD COLUMN "vendorEnteredWeight" DOUBLE PRECISION,
ADD COLUMN "vendorEnteredUnit" "QuantityUnit",
ADD COLUMN "adminAdjustedWeight" DOUBLE PRECISION,
ADD COLUMN "adminAdjustedUnit" "QuantityUnit",
ADD COLUMN "adminAdjustedAt" TIMESTAMP(3);

UPDATE "StockTransfer"
SET
  "vendorEnteredWeight" = "weight",
  "vendorEnteredUnit" = "unit"
WHERE "vendorEnteredWeight" IS NULL
  AND "weight" IS NOT NULL;
