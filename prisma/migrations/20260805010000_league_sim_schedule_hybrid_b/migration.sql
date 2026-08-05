-- Hybrid Option B: league-scoped sim games / odds / jailed (test leagues).
-- Canonical NflGame remains Odds-backed live slate for real leagues.

CREATE TABLE "league_sim_games" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "home_team_id" TEXT NOT NULL,
    "away_team_id" TEXT NOT NULL,
    "kickoff_at" TIMESTAMPTZ NOT NULL,
    "status" "nfl_game_status" NOT NULL DEFAULT 'SCHEDULED',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "finalized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "league_sim_games_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "league_sim_odds_snapshot_runs" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "status" "odds_snapshot_status" NOT NULL,
    "source" TEXT NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "league_sim_odds_snapshot_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "league_sim_game_odds_lines" (
    "id" TEXT NOT NULL,
    "league_sim_game_id" TEXT NOT NULL,
    "league_sim_odds_snapshot_run_id" TEXT NOT NULL,
    "home_moneyline_american" INTEGER,
    "away_moneyline_american" INTEGER,
    "home_spread_points" DECIMAL(5,1),

    CONSTRAINT "league_sim_game_odds_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "league_week_jailed_teams" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "nfl_season_year" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "jailed_team_id" TEXT NOT NULL,
    "resolved_by" "nfl_jailed_resolution_method" NOT NULL,
    "random_seed" TEXT,
    "audit_json" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odds_line_source_note" TEXT,

    CONSTRAINT "league_week_jailed_teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "league_sim_games_league_id_nfl_season_year_week_number_home_team_id_away_team_id_key" ON "league_sim_games"("league_id", "nfl_season_year", "week_number", "home_team_id", "away_team_id");
CREATE INDEX "league_sim_games_league_id_nfl_season_year_week_number_idx" ON "league_sim_games"("league_id", "nfl_season_year", "week_number");
CREATE INDEX "league_sim_games_league_id_nfl_season_year_week_number_status_idx" ON "league_sim_games"("league_id", "nfl_season_year", "week_number", "status");

CREATE INDEX "league_sim_odds_snapshot_runs_league_id_nfl_season_year_week_number_status_idx" ON "league_sim_odds_snapshot_runs"("league_id", "nfl_season_year", "week_number", "status");

CREATE UNIQUE INDEX "league_sim_game_odds_lines_league_sim_odds_snapshot_run_id_league_sim_game_id_key" ON "league_sim_game_odds_lines"("league_sim_odds_snapshot_run_id", "league_sim_game_id");
CREATE INDEX "league_sim_game_odds_lines_league_sim_game_id_idx" ON "league_sim_game_odds_lines"("league_sim_game_id");

CREATE UNIQUE INDEX "league_week_jailed_teams_league_id_nfl_season_year_week_number_key" ON "league_week_jailed_teams"("league_id", "nfl_season_year", "week_number");
CREATE INDEX "league_week_jailed_teams_jailed_team_id_idx" ON "league_week_jailed_teams"("jailed_team_id");

ALTER TABLE "league_sim_games" ADD CONSTRAINT "league_sim_games_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_sim_games" ADD CONSTRAINT "league_sim_games_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_sim_games" ADD CONSTRAINT "league_sim_games_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "league_sim_odds_snapshot_runs" ADD CONSTRAINT "league_sim_odds_snapshot_runs_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "league_sim_game_odds_lines" ADD CONSTRAINT "league_sim_game_odds_lines_league_sim_game_id_fkey" FOREIGN KEY ("league_sim_game_id") REFERENCES "league_sim_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_sim_game_odds_lines" ADD CONSTRAINT "league_sim_game_odds_lines_league_sim_odds_snapshot_run_id_fkey" FOREIGN KEY ("league_sim_odds_snapshot_run_id") REFERENCES "league_sim_odds_snapshot_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "league_week_jailed_teams" ADD CONSTRAINT "league_week_jailed_teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_week_jailed_teams" ADD CONSTRAINT "league_week_jailed_teams_jailed_team_id_fkey" FOREIGN KEY ("jailed_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
