/*
  Warnings:

  - You are about to drop the column `advancedAmount` on the `Bill` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AdvanceSource" AS ENUM ('PROFILE', 'BILLING');

-- CreateEnum
CREATE TYPE "AdvanceReason" AS ENUM ('PRE_SEASON_ADVANCE', 'VEHICLE_RENT', 'LABOUR_CHARGES', 'DIESEL_EXPENSE', 'EMERGENCY_EXPENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvanceTxnType" AS ENUM ('CREDIT', 'ADJUSTMENT', 'REVERSAL');

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "advancedAmount";

-- CreateTable
CREATE TABLE "FarmerAdvance" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "billId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "txnType" "AdvanceTxnType" NOT NULL,
    "source" "AdvanceSource" NOT NULL,
    "reason" "AdvanceReason" NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillSettlement" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidDate" TIMESTAMP(3),
    "reference" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmerAdvance_farmerId_createdAt_idx" ON "FarmerAdvance"("farmerId", "createdAt");

-- CreateIndex
CREATE INDEX "FarmerAdvance_billId_idx" ON "FarmerAdvance"("billId");

-- CreateIndex
CREATE INDEX "BillSettlement_billId_createdAt_idx" ON "BillSettlement"("billId", "createdAt");

-- CreateIndex
CREATE INDEX "BillSettlement_farmerId_createdAt_idx" ON "BillSettlement"("farmerId", "createdAt");

-- AddForeignKey
ALTER TABLE "FarmerAdvance" ADD CONSTRAINT "FarmerAdvance_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerAdvance" ADD CONSTRAINT "FarmerAdvance_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerAdvance" ADD CONSTRAINT "FarmerAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSettlement" ADD CONSTRAINT "BillSettlement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSettlement" ADD CONSTRAINT "BillSettlement_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSettlement" ADD CONSTRAINT "BillSettlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
