/*
  Warnings:

  - You are about to drop the column `productId` on the `Bill` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_productId_fkey";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "productId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totalKattaStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSoyaKg" DOUBLE PRECISION NOT NULL DEFAULT 0;
