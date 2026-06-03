-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "toVendorId" TEXT;

-- CreateIndex
CREATE INDEX "StockTransfer_toVendorId_idx" ON "StockTransfer"("toVendorId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toVendorId_fkey" FOREIGN KEY ("toVendorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
