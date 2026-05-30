-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'HOLD';
ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';

-- CreateTable
CREATE TABLE "PaymentActivity" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "oldStatus" "PaymentStatus",
    "newStatus" "PaymentStatus" NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentActivity_billId_createdAt_idx" ON "PaymentActivity"("billId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentActivity_farmerId_createdAt_idx" ON "PaymentActivity"("farmerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentActivity" ADD CONSTRAINT "PaymentActivity_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentActivity" ADD CONSTRAINT "PaymentActivity_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentActivity" ADD CONSTRAINT "PaymentActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
