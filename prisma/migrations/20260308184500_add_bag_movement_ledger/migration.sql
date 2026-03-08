-- CreateEnum
CREATE TYPE "BagMovementType" AS ENUM ('ADMIN_TO_VENDOR', 'VENDOR_TO_FARMER', 'VENDOR_TO_ADMIN');

-- CreateTable
CREATE TABLE "BagMovement" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "farmerId" TEXT,
    "transferId" TEXT,
    "bagCount" INTEGER NOT NULL,
    "movementType" "BagMovementType" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BagMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BagMovement_vendorId_goniTypeId_movementType_idx" ON "BagMovement"("vendorId", "goniTypeId", "movementType");

-- CreateIndex
CREATE INDEX "BagMovement_farmerId_idx" ON "BagMovement"("farmerId");

-- CreateIndex
CREATE INDEX "BagMovement_transferId_idx" ON "BagMovement"("transferId");

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
