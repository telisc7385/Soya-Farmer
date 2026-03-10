-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferItem_goniTypeId_idx" ON "StockTransferItem"("goniTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItem_transferId_goniTypeId_key" ON "StockTransferItem"("transferId", "goniTypeId");

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
