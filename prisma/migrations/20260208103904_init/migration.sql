/*
  Warnings:

  - You are about to drop the column `millId` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockOverride` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_millId_fkey";

-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_billId_fkey";

-- DropForeignKey
ALTER TABLE "StockOverride" DROP CONSTRAINT "StockOverride_farmerId_fkey";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "millId",
DROP COLUMN "vehicleId";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "StockOverride";
