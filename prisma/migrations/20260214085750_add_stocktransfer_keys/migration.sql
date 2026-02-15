/*
  Warnings:

  - Added the required column `quality` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shopLocation` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicalNumber` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "quality" "QuantityUnit" NOT NULL,
ADD COLUMN     "shopLocation" TEXT NOT NULL,
ADD COLUMN     "shopName" TEXT,
ADD COLUMN     "vehicalNumber" TEXT NOT NULL;
