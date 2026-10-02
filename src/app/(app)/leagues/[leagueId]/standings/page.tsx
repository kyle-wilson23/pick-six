import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { TestLeagueBanner } from "@/components/league/TestLeagueBanner";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getLeagueStandings } from "@/lib/scoring/get-league-standings";
import { rankBiggestLosers } from "@/lib/scoring/rank-biggest-losers";
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueStandingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access) {
    notFound();
  }
  const nflSeasonYear = getCurrentNflSeasonYear();
  const standings = await getLeagueStandings(prisma, { leagueId, nflSeasonYear });
  const currentMembershipId = access.membership?.id ?? "";

  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        ...skipTargetMainSx,
        ...appContentWidthSx,
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h4" component="h1">
        Standings
      </Typography>

      {access.league.isTestLeague ? <TestLeagueBanner /> : null}

      <StandingsTable standings={standings} currentMembershipId={currentMembershipId} />

      {standings.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            Biggest Loser
          </Typography>
          <StandingsTable
            variant="biggest-loser"
            standings={rankBiggestLosers(standings)}
            currentMembershipId={currentMembershipId}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
