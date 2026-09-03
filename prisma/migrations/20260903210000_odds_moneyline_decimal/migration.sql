-- Widen moneyline columns so European decimal odds (e.g. 1.910) can persist.
-- Existing American integers (e.g. -150) are left as-is.

ALTER TABLE "nfl_game_odds_lines"
  ALTER COLUMN "home_moneyline_american" TYPE DECIMAL(10,3),
  ALTER COLUMN "away_moneyline_american" TYPE DECIMAL(10,3);

ALTER TABLE "league_sim_game_odds_lines"
  ALTER COLUMN "home_moneyline_american" TYPE DECIMAL(10,3),
  ALTER COLUMN "away_moneyline_american" TYPE DECIMAL(10,3);
