/*
  Warnings:

  - You are about to drop the column `bagCount` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `goniTypeId` on the `Bill` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_goniTypeId_fkey";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "bagCount",
DROP COLUMN "goniTypeId";

-- CreateTable
CREATE TABLE "BillGoni" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillGoni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillGoni_billId_idx" ON "BillGoni"("billId");

-- CreateIndex
CREATE INDEX "BillGoni_goniTypeId_idx" ON "BillGoni"("goniTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "BillGoni_billId_goniTypeId_key" ON "BillGoni"("billId", "goniTypeId");

-- AddForeignKey
ALTER TABLE "BillGoni" ADD CONSTRAINT "BillGoni_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillGoni" ADD CONSTRAINT "BillGoni_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
