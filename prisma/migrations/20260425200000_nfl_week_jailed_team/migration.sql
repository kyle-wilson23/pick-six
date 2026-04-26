-- CreateEnum
CREATE TYPE "nfl_jailed_resolution_method" AS ENUM ('MONEYLINE', 'SPREAD', 'RANDOM');

-- CreateTable
CREATE TABLE "nfl_week_jailed_teams" (
    "id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "jailed_team_id" TEXT NOT NULL,
    "resolved_by" "nfl_jailed_resolution_method" NOT NULL,
    "random_seed" TEXT,
    "audit_json" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odds_line_source_note" TEXT,

    CONSTRAINT "nfl_week_jailed_teams_pkey" PRIMARY KEY ("id"),
    -- FR52: random_seed is present iff the row was resolved by RANDOM. Prevents drift between the
    -- column and `audit_json.randomSeed`, and ensures non-RANDOM rows cannot accidentally carry a
    -- stale seed (or RANDOM rows lose their reproducibility seed).
    CONSTRAINT "nfl_week_jailed_teams_random_seed_iff_random" CHECK (
        ("resolved_by" = 'RANDOM') = ("random_seed" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "nfl_week_jailed_teams_nfl_season_year_week_number_key" ON "nfl_week_jailed_teams"("nfl_season_year", "week_number");

-- CreateIndex
CREATE INDEX "nfl_week_jailed_teams_jailed_team_id_idx" ON "nfl_week_jailed_teams"("jailed_team_id");

-- AddForeignKey
ALTER TABLE "nfl_week_jailed_teams" ADD CONSTRAINT "nfl_week_jailed_teams_jailed_team_id_fkey" FOREIGN KEY ("jailed_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
