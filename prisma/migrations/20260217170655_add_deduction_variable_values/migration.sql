-- AlterTable
ALTER TABLE "DeductionMaster" ADD COLUMN     "variableValues" JSONB;

-- AlterTable
ALTER TABLE "StockTransfer" ALTER COLUMN "weight" DROP NOT NULL,
ALTER COLUMN "unit" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QualityRate" (
    "id" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualityRate_quality_key" ON "QualityRate"("quality");
