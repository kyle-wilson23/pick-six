-- CreateEnum
CREATE TYPE "pick_outcome" AS ENUM ('WIN', 'LOSS', 'TIE');

-- AlterTable
ALTER TABLE "picks" ADD COLUMN "outcome" "pick_outcome",
ADD COLUMN "points_earned" INTEGER,
ADD COLUMN "scored_at" TIMESTAMPTZ;
