-- Phase 2: Inventory locations and transfer source/destination keys

CREATE TYPE "InventoryLocationType" AS ENUM ('VENDOR', 'GODOWN', 'PLANT');

CREATE TABLE "InventoryLocation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "type" "InventoryLocationType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");
CREATE INDEX "InventoryLocation_type_isActive_idx" ON "InventoryLocation"("type", "isActive");

ALTER TABLE "StockTransfer"
  ADD COLUMN "sourceLocationId" TEXT,
  ADD COLUMN "destinationLocationId" TEXT;

ALTER TABLE "StockTransfer"
  DROP COLUMN IF EXISTS "shopName",
  DROP COLUMN IF EXISTS "shopLocation";

CREATE INDEX "StockTransfer_sourceLocationId_idx" ON "StockTransfer"("sourceLocationId");
CREATE INDEX "StockTransfer_destinationLocationId_idx" ON "StockTransfer"("destinationLocationId");

ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_sourceLocationId_fkey"
  FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_destinationLocationId_fkey"
  FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
