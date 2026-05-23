-- CreateEnum
CREATE TYPE "ThappiStatus" AS ENUM ('AVAILABLE', 'TRANSFERRED');

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "dispatchById" TEXT,
ADD COLUMN     "dispatchLatitude" DOUBLE PRECISION,
ADD COLUMN     "dispatchLocationText" TEXT,
ADD COLUMN     "dispatchLongitude" DOUBLE PRECISION,
ADD COLUMN     "dispatchProofUrl" TEXT,
ADD COLUMN     "receiveById" TEXT,
ADD COLUMN     "receiveLatitude" DOUBLE PRECISION,
ADD COLUMN     "receiveLocationText" TEXT,
ADD COLUMN     "receiveLongitude" DOUBLE PRECISION,
ADD COLUMN     "receiveProofUrl" TEXT;

-- CreateTable
CREATE TABLE "Thappi" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "weightQtl" DOUBLE PRECISION NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "moisture" DOUBLE PRECISION,
    "fm" DOUBLE PRECISION,
    "damage" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "status" "ThappiStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thappi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThappiBagBreakdown" (
    "id" TEXT NOT NULL,
    "thappiId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThappiBagBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferThappi" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "thappiId" TEXT NOT NULL,
    "weightQtl" DOUBLE PRECISION NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferThappi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Thappi_code_key" ON "Thappi"("code");

-- CreateIndex
CREATE INDEX "Thappi_vendorId_status_isActive_idx" ON "Thappi"("vendorId", "status", "isActive");

-- CreateIndex
CREATE INDEX "Thappi_locationId_idx" ON "Thappi"("locationId");

-- CreateIndex
CREATE INDEX "ThappiBagBreakdown_thappiId_idx" ON "ThappiBagBreakdown"("thappiId");

-- CreateIndex
CREATE UNIQUE INDEX "ThappiBagBreakdown_thappiId_goniTypeId_key" ON "ThappiBagBreakdown"("thappiId", "goniTypeId");

-- CreateIndex
CREATE INDEX "StockTransferThappi_transferId_idx" ON "StockTransferThappi"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferThappi_thappiId_idx" ON "StockTransferThappi"("thappiId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferThappi_transferId_thappiId_key" ON "StockTransferThappi"("transferId", "thappiId");

-- AddForeignKey
ALTER TABLE "Thappi" ADD CONSTRAINT "Thappi_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thappi" ADD CONSTRAINT "Thappi_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiBagBreakdown" ADD CONSTRAINT "ThappiBagBreakdown_thappiId_fkey" FOREIGN KEY ("thappiId") REFERENCES "Thappi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThappiBagBreakdown" ADD CONSTRAINT "ThappiBagBreakdown_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferThappi" ADD CONSTRAINT "StockTransferThappi_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferThappi" ADD CONSTRAINT "StockTransferThappi_thappiId_fkey" FOREIGN KEY ("thappiId") REFERENCES "Thappi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
