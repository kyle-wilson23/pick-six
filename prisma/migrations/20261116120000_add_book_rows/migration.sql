-- CreateTable
CREATE TABLE "book_rows" (
    "id" TEXT NOT NULL,
    "league_person_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "outcome" "pick_outcome" NOT NULL,
    "points" INTEGER NOT NULL,
    "team_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_rows_league_person_id_nfl_season_year_week_number_key" ON "book_rows"("league_person_id", "nfl_season_year", "week_number");

-- AddForeignKey
ALTER TABLE "book_rows" ADD CONSTRAINT "book_rows_league_person_id_fkey" FOREIGN KEY ("league_person_id") REFERENCES "league_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_rows" ADD CONSTRAINT "book_rows_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
