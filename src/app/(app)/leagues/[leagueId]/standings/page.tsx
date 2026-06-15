import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StandingsTable } from "@/components/standings/StandingsTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getLeagueStandings } from "@/lib/scoring/get-league-standings";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueStandingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
    include: { league: { select: { name: true } } },
  });

  if (!membership || !isLeagueParticipantRole(membership.role) || !membership.league) {
    notFound();
  }

  const { league } = membership;
  const nflSeasonYear = getCurrentNflSeasonYear();
  const standings = await getLeagueStandings(prisma, { leagueId, nflSeasonYear });

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
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>

      <Typography variant="h4" component="h1">
        Standings
      </Typography>

      <StandingsTable standings={standings} currentMembershipId={membership.id} />
    </Stack>
  );
}
