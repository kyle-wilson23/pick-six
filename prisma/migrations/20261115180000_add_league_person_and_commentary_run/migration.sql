-- CreateEnum
CREATE TYPE "commentary_run_status" AS ENUM ('STARTED', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "league_persons" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "league_membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "league_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentary_runs" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "status" "commentary_run_status" NOT NULL,
    "stop_reason" TEXT,
    "spend_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "sentences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commentary_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_persons_league_membership_id_key" ON "league_persons"("league_membership_id");

-- CreateIndex
CREATE INDEX "league_persons_league_id_idx" ON "league_persons"("league_id");

-- CreateIndex
CREATE UNIQUE INDEX "commentary_runs_league_id_nfl_season_year_week_number_key" ON "commentary_runs"("league_id", "nfl_season_year", "week_number");

-- AddForeignKey
ALTER TABLE "league_persons" ADD CONSTRAINT "league_persons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_persons" ADD CONSTRAINT "league_persons_league_membership_id_fkey" FOREIGN KEY ("league_membership_id") REFERENCES "league_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentary_runs" ADD CONSTRAINT "commentary_runs_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
