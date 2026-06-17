import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeagueResultsTable } from "@/components/results/LeagueResultsTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getLeaguePeerPickHistory } from "@/lib/scoring/get-league-peer-pick-history";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueResultsPage({ params }: PageProps) {
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
  const history = await getLeaguePeerPickHistory(prisma, {
    leagueId,
    nflSeasonYear,
    callerRole: membership.role,
  });

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 720,
        mx: "auto",
      }}
    >
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>

      <Typography variant="h4" component="h1">
        League Results
      </Typography>

      <LeagueResultsTable history={history} currentMembershipId={membership.id} />
    </Stack>
  );
}
