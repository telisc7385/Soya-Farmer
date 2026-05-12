-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDOR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'BANK', 'PAN', 'DRIVING_LICENSE', 'LAND_712', 'BLOOD_RELATION_712');

-- CreateEnum
CREATE TYPE "LandType" AS ENUM ('OWN', 'BLOOD_RELATION');

-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('QTL', 'MT');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "DeductionType" AS ENUM ('FIXED', 'FORMULA');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReKycStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "BagMovementType" AS ENUM ('FARMER_TO_VENDOR', 'ADMIN_TO_VENDOR', 'VENDOR_TO_FARMER', 'VENDOR_TO_ADMIN', 'VENDOR_SELF_ADD', 'ADMIN_TO_VENDOR_ADD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vendorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factoryRateDiff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterVendor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "villageAdd" TEXT,
    "taluka" TEXT,
    "district" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aadhaarNo" TEXT NOT NULL,
    "panNo" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "profileUrl" TEXT,
    "villageAdd" TEXT,
    "gutNumber" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "kycSubmittedAt" TIMESTAMP(3),
    "kycVerifiedAt" TIMESTAMP(3),
    "kycVerifiedById" TEXT,
    "kycRejectionReason" TEXT,
    "reKycDate" TIMESTAMP(3),
    "reKycStatus" "ReKycStatus" NOT NULL DEFAULT 'NOT_REQUIRED',

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
    "villageAdd" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerLand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "advancedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "primaryQuantity" DOUBLE PRECISION,
    "primaryUnit" "QuantityUnit",
    "ratePerUnit" DOUBLE PRECISION,
    "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vehicleNumber" TEXT,
    "vehicleType" TEXT,
    "driverName" TEXT,
    "billLocation" TEXT,
    "goniWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

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
    "passbookImage" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FarmerBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDetails" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDetails_pkey" PRIMARY KEY ("id")
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
    "variableValues" JSONB,
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
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoniType_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "goniTypeId" TEXT,
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "goniTypeId" TEXT,
    "vendorEnteredWeight" DOUBLE PRECISION,
    "vendorEnteredUnit" "QuantityUnit",
    "adminAdjustedWeight" DOUBLE PRECISION,
    "adminAdjustedUnit" "QuantityUnit",
    "adminAdjustedAt" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "unit" "QuantityUnit",
    "shopName" TEXT,
    "shopLocation" TEXT NOT NULL,
    "vehicalNumber" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BagMovement" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "goniTypeId" TEXT NOT NULL,
    "farmerId" TEXT,
    "transferId" TEXT,
    "bagCount" INTEGER NOT NULL,
    "movementType" "BagMovementType" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BagMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_aadhaarNo_key" ON "Farmer"("aadhaarNo");

-- CreateIndex
CREATE UNIQUE INDEX "VendorFarmer_vendorId_farmerId_key" ON "VendorFarmer"("vendorId", "farmerId");

-- CreateIndex
CREATE INDEX "BillGoni_billId_idx" ON "BillGoni"("billId");

-- CreateIndex
CREATE INDEX "BillGoni_goniTypeId_idx" ON "BillGoni"("goniTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "BillGoni_billId_goniTypeId_key" ON "BillGoni"("billId", "goniTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "BankDetails_ifsc_key" ON "BankDetails"("ifsc");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerPayment_billId_key" ON "FarmerPayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionVariable_masterId_code_key" ON "DeductionVariable"("masterId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "QualityRate_quality_key" ON "QualityRate"("quality");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_billId_key" ON "Stock"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferItem_goniTypeId_idx" ON "StockTransferItem"("goniTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItem_transferId_goniTypeId_key" ON "StockTransferItem"("transferId", "goniTypeId");

-- CreateIndex
CREATE INDEX "BagMovement_vendorId_goniTypeId_movementType_idx" ON "BagMovement"("vendorId", "goniTypeId", "movementType");

-- CreateIndex
CREATE INDEX "BagMovement_farmerId_idx" ON "BagMovement"("farmerId");

-- CreateIndex
CREATE INDEX "BagMovement_transferId_idx" ON "BagMovement"("transferId");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_kycVerifiedById_fkey" FOREIGN KEY ("kycVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorFarmer" ADD CONSTRAINT "VendorFarmer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorFarmer" ADD CONSTRAINT "VendorFarmer_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerDocument" ADD CONSTRAINT "FarmerDocument_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerLand" ADD CONSTRAINT "FarmerLand_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillGoni" ADD CONSTRAINT "BillGoni_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillGoni" ADD CONSTRAINT "BillGoni_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_goniTypeId_fkey" FOREIGN KEY ("goniTypeId") REFERENCES "GoniType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagMovement" ADD CONSTRAINT "BagMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
