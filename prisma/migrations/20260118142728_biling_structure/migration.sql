/*
  Warnings:

  - Added the required column `quantity` to the `BillItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit` to the `BillItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('KG', 'QTL');

-- AlterEnum
ALTER TYPE "BillStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "BillItem" ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unit" "QuantityUnit" NOT NULL;
