-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockTransferStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "StockTransferStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "StockTransferStatus" ADD VALUE 'DISCREPANCY';

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "bagShortage" INTEGER,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchedBagCount" INTEGER,
ADD COLUMN     "dispatchedWeight" DOUBLE PRECISION,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedBagCount" INTEGER,
ADD COLUMN     "receivedWeight" DOUBLE PRECISION,
ADD COLUMN     "weightShortage" DOUBLE PRECISION;
