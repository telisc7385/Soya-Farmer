/*
  Warnings:

  - The values [RESERVED,SOLD] on the enum `StockStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [APPROVED,REJECTED] on the enum `StockTransferStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `batchNo` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `minStockAlert` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerUnit` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `productType` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `qualityGrade` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `receivedDate` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `shopName` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `taluka` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `villageAdd` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the column `adminId` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `requestedAt` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `totalBags` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `totalWeight` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `StockTransfer` table. All the data in the column will be lost.
  - You are about to drop the `StockTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockTransferItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[billId]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billId` to the `Stock` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bagCount` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weight` to the `StockTransfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StockStatus_new" AS ENUM ('AVAILABLE', 'TRANSFERRED');
ALTER TABLE "public"."Stock" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Stock" ALTER COLUMN "status" TYPE "StockStatus_new" USING ("status"::text::"StockStatus_new");
ALTER TYPE "StockStatus" RENAME TO "StockStatus_old";
ALTER TYPE "StockStatus_new" RENAME TO "StockStatus";
DROP TYPE "public"."StockStatus_old";
ALTER TABLE "Stock" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StockTransferStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."StockTransfer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StockTransfer" ALTER COLUMN "status" TYPE "StockTransferStatus_new" USING ("status"::text::"StockTransferStatus_new");
ALTER TYPE "StockTransferStatus" RENAME TO "StockTransferStatus_old";
ALTER TYPE "StockTransferStatus_new" RENAME TO "StockTransferStatus";
DROP TYPE "public"."StockTransferStatus_old";
ALTER TABLE "StockTransfer" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_performedBy_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_stockId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransaction" DROP CONSTRAINT "StockTransaction_transferId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_adminId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransfer" DROP CONSTRAINT "StockTransfer_approvedBy_fkey";

-- DropForeignKey
ALTER TABLE "StockTransferItem" DROP CONSTRAINT "StockTransferItem_stockId_fkey";

-- DropForeignKey
ALTER TABLE "StockTransferItem" DROP CONSTRAINT "StockTransferItem_transferId_fkey";

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "batchNo",
DROP COLUMN "district",
DROP COLUMN "expiryDate",
DROP COLUMN "location",
DROP COLUMN "minStockAlert",
DROP COLUMN "pricePerUnit",
DROP COLUMN "productType",
DROP COLUMN "qualityGrade",
DROP COLUMN "receivedDate",
DROP COLUMN "remarks",
DROP COLUMN "shopName",
DROP COLUMN "taluka",
DROP COLUMN "villageAdd",
ADD COLUMN     "billId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StockTransfer" DROP COLUMN "adminId",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedBy",
DROP COLUMN "reason",
DROP COLUMN "remarks",
DROP COLUMN "requestedAt",
DROP COLUMN "totalBags",
DROP COLUMN "totalWeight",
DROP COLUMN "updatedAt",
ADD COLUMN     "bagCount" INTEGER NOT NULL,
ADD COLUMN     "goniTypeId" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL;

-- DropTable
DROP TABLE "StockTransaction";

-- DropTable
DROP TABLE "StockTransferItem";

-- DropEnum
DROP TYPE "QualityGrade";

-- DropEnum
DROP TYPE "TransactionType";

-- CreateIndex
CREATE UNIQUE INDEX "Stock_billId_key" ON "Stock"("billId");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
