/*
  Warnings:

  - The values [SPLIT_OUT,SPLIT_IN,MERGE_OUT,MERGE_IN] on the enum `ThappiMovementType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ThappiMovementType_new" AS ENUM ('CREATE', 'TRANSFER_OUT', 'TRANSFER_IN');
ALTER TABLE "ThappiMovement" ALTER COLUMN "movementType" TYPE "ThappiMovementType_new" USING ("movementType"::text::"ThappiMovementType_new");
ALTER TYPE "ThappiMovementType" RENAME TO "ThappiMovementType_old";
ALTER TYPE "ThappiMovementType_new" RENAME TO "ThappiMovementType";
DROP TYPE "public"."ThappiMovementType_old";
COMMIT;
