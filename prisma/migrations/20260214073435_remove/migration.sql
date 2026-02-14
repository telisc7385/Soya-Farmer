/*
  Warnings:

  - You are about to drop the column `totalKattaStock` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `totalSoyaKg` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `BillItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockMovement` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_billId_fkey";

-- DropForeignKey
ALTER TABLE "BillItem" DROP CONSTRAINT "BillItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_farmerId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_productId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_stockId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "totalKattaStock",
DROP COLUMN "totalSoyaKg";

-- DropTable
DROP TABLE "BillItem";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "Stock";

-- DropTable
DROP TABLE "StockMovement";

-- DropEnum
DROP TYPE "ProductType";

-- DropEnum
DROP TYPE "StockMovementType";
