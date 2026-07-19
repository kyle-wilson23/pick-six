import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TestLeagueChip } from "@/components/league/TestLeagueChip";
import { CreateLeagueLinkButton } from "@/components/leagues/create-league-link-button";
import { auth } from "@/lib/auth";
import { describeSeasonForParticipant, listJoinedLeaguesWithCurrentSeason } from "@/lib/league/list-joined-leagues";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";

export default async function MyLeaguesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const rows = await listJoinedLeaguesWithCurrentSeason(userId, nflSeasonYear);

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
        Your leagues
      </Typography>
      <Typography variant="body2" color="text.secondary">
        NFL season year used for the current season row: {nflSeasonYear}.
      </Typography>

      {rows.length === 0 ? (
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="body1" color="text.secondary">
            You are not in any leagues yet. Create a league to get started, or ask an admin for an
            invite.
          </Typography>
          <CreateLeagueLinkButton />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {rows.map((row) => (
            <Paper key={row.league.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h6" component="h2">
                    <Link href={`/leagues/${row.league.id}`}>{row.league.name}</Link>
                  </Typography>
                  {row.league.isTestLeague ? <TestLeagueChip /> : null}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Role: {row.role}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {describeSeasonForParticipant({ nflSeasonYear, season: row.season })}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
