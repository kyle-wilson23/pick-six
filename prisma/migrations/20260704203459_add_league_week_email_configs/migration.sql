-- CreateTable
CREATE TABLE "league_week_email_configs" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "body_text" TEXT,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "league_week_email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_week_email_configs_league_id_nfl_season_year_idx" ON "league_week_email_configs"("league_id", "nfl_season_year");

-- CreateIndex
CREATE UNIQUE INDEX "league_week_email_configs_league_id_nfl_season_year_week_nu_key" ON "league_week_email_configs"("league_id", "nfl_season_year", "week_number");

-- AddForeignKey
ALTER TABLE "league_week_email_configs" ADD CONSTRAINT "league_week_email_configs_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
