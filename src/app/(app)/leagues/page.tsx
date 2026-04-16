import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { AdminLeagueRowActions } from "@/components/leagues/admin-league-row-actions";
import { CreateLeagueLinkButton } from "@/components/leagues/create-league-link-button";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { listAdministeredLeaguesWithCurrentSeason } from "@/lib/league/list-administered-leagues";

export default async function AdminLeaguesListPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const rows = await listAdministeredLeaguesWithCurrentSeason(userId, nflSeasonYear);

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 560,
        mx: "auto",
      }}
    >
      <Typography variant="h4" component="h1">
        Leagues you administer
      </Typography>
      <Typography variant="body2" color="text.secondary">
        NFL season year used for the current season row: {nflSeasonYear}.
      </Typography>

      {rows.length === 0 ? (
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="body1" color="text.secondary">
            You are not an admin of any league yet. Create a league to get started.
          </Typography>
          <CreateLeagueLinkButton />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {rows.map((row) => (
            <Paper key={row.league.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="h6" component="h2">
                  {row.league.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.season
                    ? `Current season: ${row.season.nflSeasonYear} · First competition week ${row.season.firstCompetitionWeek}${
                        row.season.preSeasonInitializedAt
                          ? " · Pre-season initialized"
                          : " · Pre-season not initialized"
                      }`
                    : `No season row for NFL ${nflSeasonYear} yet (unexpected if the league was created in-app).`}
                </Typography>
                <AdminLeagueRowActions leagueId={row.league.id} />
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
