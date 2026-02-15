/*
  Warnings:

  - You are about to drop the column `quality` on the `StockTransfer` table. All the data in the column will be lost.
  - Added the required column `quantity` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StockTransfer" DROP COLUMN "quality",
ADD COLUMN     "quantity" "QuantityUnit" NOT NULL;
