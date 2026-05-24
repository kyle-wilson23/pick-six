-- Natural key for idempotent NFL schedule sync (Story 3.9). Preserves stable `nfl_games.id` for `nfl_game_odds_lines`.
CREATE UNIQUE INDEX "nfl_games_nfl_season_year_week_number_home_team_id_away_team_id_key"
ON "nfl_games" ("nfl_season_year", "week_number", "home_team_id", "away_team_id");
