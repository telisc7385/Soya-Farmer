/*
  Warnings:

  - A unique constraint covering the columns `[farmerId]` on the table `StockOverride` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "StockOverride_farmerId_key" ON "StockOverride"("farmerId");
