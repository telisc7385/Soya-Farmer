-- AlterTable
ALTER TABLE "GoniType"
ADD COLUMN "isTracked" BOOLEAN NOT NULL DEFAULT false;

-- Ensure only one goni type can be tracked at any time
CREATE UNIQUE INDEX "GoniType_only_one_tracked_true_idx"
ON "GoniType" ("isTracked")
WHERE "isTracked" = true;
