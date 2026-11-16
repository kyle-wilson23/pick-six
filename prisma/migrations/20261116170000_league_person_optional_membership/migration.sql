-- AlterTable
ALTER TABLE "league_persons" ALTER COLUMN "league_membership_id" DROP NOT NULL,
ADD COLUMN "display_name" TEXT;
