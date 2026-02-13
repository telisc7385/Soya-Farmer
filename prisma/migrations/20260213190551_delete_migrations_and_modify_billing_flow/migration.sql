-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDOR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'BANK', 'PAN', 'DRIVING_LICENSE', 'LAND_712', 'BLOOD_RELATION_712');

-- CreateEnum
CREATE TYPE "LandType" AS ENUM ('OWN', 'BLOOD_RELATION');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('KATTA', 'SOYAPRODUCT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('QTL', 'MT');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('FIXED', 'FORMULA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "villageAdd" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "totalKattaStock" INTEGER NOT NULL DEFAULT 0,
    "totalSoyaKg" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aadhaarNo" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "villageAdd" TEXT,
    "gutNumber" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorFarmer" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorFarmer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerDocument" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerLand" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "landType" "LandType" NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerLand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "primaryQuantity" DOUBLE PRECISION,
    "primaryUnit" "QuantityUnit",
    "ratePerUnit" DOUBLE PRECISION,
    "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goniTypeId" TEXT,
    "bagCount" INTEGER NOT NULL DEFAULT 0,
    "goniWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillDeduction" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "masterId" TEXT,
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "payload" JSONB,

    CONSTRAINT "BillDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerBank" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "passbookImage" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FarmerBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paidDate" TIMESTAMP(3),
    "reference" TEXT,

    CONSTRAINT "FarmerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeductionType" NOT NULL,
    "baseAmount" DOUBLE PRECISION,
    "formulaExpression" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeductionMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionVariable" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeductionVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoniType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightPerBag" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoniType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_aadhaarNo_key" ON "Farmer"("aadhaarNo");

-- CreateIndex
CREATE UNIQUE INDEX "VendorFarmer_vendorId_farmerId_key" ON "VendorFarmer"("vendorId", "farmerId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_vendorId_farmerId_productId_key" ON "Stock"("vendorId", "farmerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerPayment_billId_key" ON "FarmerPayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionVariable_masterId_code_key" ON "DeductionVariable"("masterId", "code");

-- AddForeignKey
ALTER TABLE "VendorFarmer" ADD CONSTRAINT "VendorFarmer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorFarmer" ADD CONSTRAINT "VendorFarmer_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerDocument" ADD CONSTRAINT "FarmerDocument_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerLand" ADD CONSTRAINT "FarmerLand_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDeduction" ADD CONSTRAINT "BillDeduction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillDeduction" ADD CONSTRAINT "BillDeduction_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "DeductionMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerBank" ADD CONSTRAINT "FarmerBank_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerPayment" ADD CONSTRAINT "FarmerPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerPayment" ADD CONSTRAINT "FarmerPayment_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionMaster" ADD CONSTRAINT "DeductionMaster_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionVariable" ADD CONSTRAINT "DeductionVariable_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "DeductionMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoniType" ADD CONSTRAINT "GoniType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
