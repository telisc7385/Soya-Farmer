-- CreateEnum
CREATE TYPE "ThappiMovementType" AS ENUM ('CREATE', 'TRANSFER_OUT', 'TRANSFER_IN', 'SPLIT_OUT', 'SPLIT_IN', 'MERGE_OUT', 'MERGE_IN');

-- CreateTable
CREATE TABLE "ThappiMovement" (
    "id" TEXT NOT NULL,
    "thappiId" TEXT NOT NULL,
    "transferId" TEXT,
    "movementType" "ThappiMovementType" NOT NULL,
    "weightQtl" DOUBLE PRECISION NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThappiMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThappiMovement_thappiId_createdAt_idx" ON "ThappiMovement"("thappiId", "createdAt");

-- CreateIndex
CREATE INDEX "ThappiMovement_transferId_idx" ON "ThappiMovement"("transferId");

-- AddForeignKey
ALTER TABLE "ThappiMovement" ADD CONSTRAINT "ThappiMovement_thappiId_fkey" FOREIGN KEY ("thappiId") REFERENCES "Thappi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiMovement" ADD CONSTRAINT "ThappiMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiMovement" ADD CONSTRAINT "ThappiMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiMovement" ADD CONSTRAINT "ThappiMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiMovement" ADD CONSTRAINT "ThappiMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
