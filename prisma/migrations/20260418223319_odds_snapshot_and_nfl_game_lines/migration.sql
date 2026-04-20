-- CreateEnum
CREATE TYPE "odds_snapshot_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "odds_snapshot_runs" (
    "id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "status" "odds_snapshot_status" NOT NULL,
    "source" TEXT NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "odds_snapshot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfl_game_odds_lines" (
    "id" TEXT NOT NULL,
    "nfl_game_id" TEXT NOT NULL,
    "odds_snapshot_run_id" TEXT NOT NULL,
    "home_moneyline_american" INTEGER,
    "away_moneyline_american" INTEGER,
    "home_spread_points" DECIMAL(5,1),

    CONSTRAINT "nfl_game_odds_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odds_snapshot_runs_nfl_season_year_week_number_status_idx" ON "odds_snapshot_runs"("nfl_season_year", "week_number", "status");

-- CreateIndex
CREATE INDEX "nfl_game_odds_lines_nfl_game_id_idx" ON "nfl_game_odds_lines"("nfl_game_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfl_game_odds_lines_odds_snapshot_run_id_nfl_game_id_key" ON "nfl_game_odds_lines"("odds_snapshot_run_id", "nfl_game_id");

-- AddForeignKey
ALTER TABLE "nfl_game_odds_lines" ADD CONSTRAINT "nfl_game_odds_lines_nfl_game_id_fkey" FOREIGN KEY ("nfl_game_id") REFERENCES "nfl_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfl_game_odds_lines" ADD CONSTRAINT "nfl_game_odds_lines_odds_snapshot_run_id_fkey" FOREIGN KEY ("odds_snapshot_run_id") REFERENCES "odds_snapshot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
