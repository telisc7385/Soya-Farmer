-- AlterTable
ALTER TABLE "User"
ADD COLUMN "villageAdd" TEXT,
ADD COLUMN "taluka" TEXT,
ADD COLUMN "district" TEXT;

-- DropTable
DROP TABLE "Mill";
