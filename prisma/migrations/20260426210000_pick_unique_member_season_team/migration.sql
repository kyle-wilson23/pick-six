-- Story 3.4 (code review patch): enforce FR53 duplicate-team rule at the DB layer.
-- Prevents two concurrent picks with the same teamId for the same member+season from
-- both passing the application-layer duplicate check under READ COMMITTED isolation.
CREATE UNIQUE INDEX "picks_league_membership_id_season_id_team_id_key"
  ON "picks"("league_membership_id", "season_id", "team_id");
