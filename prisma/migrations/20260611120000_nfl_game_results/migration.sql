-- CreateEnum
CREATE TYPE "nfl_game_status" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINAL', 'CANCELLED');

-- AlterTable
ALTER TABLE "nfl_games" ADD COLUMN "status" "nfl_game_status" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "nfl_games" ADD COLUMN "home_score" INTEGER;
ALTER TABLE "nfl_games" ADD COLUMN "away_score" INTEGER;
ALTER TABLE "nfl_games" ADD COLUMN "finalized_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "idx_nfl_games_status_week" ON "nfl_games"("nfl_season_year", "week_number", "status");
