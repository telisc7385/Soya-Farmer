/*
  Warnings:

  - You are about to drop the column `isPrimary` on the `FarmerBank` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FarmerBank" DROP COLUMN "isPrimary";

-- AlterTable
ALTER TABLE "FarmerLand" ADD COLUMN     "district" TEXT,
ADD COLUMN     "taluka" TEXT,
ADD COLUMN     "villageAdd" TEXT;
