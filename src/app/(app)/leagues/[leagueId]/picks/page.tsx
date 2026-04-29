import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { buildLeaguePicksWeekView } from "@/lib/picks/build-league-picks-week-view";
import type { BuildLeaguePicksWeekViewOutcome } from "@/lib/picks/build-league-picks-week-view";
import { parseWeekNumberSearchParam } from "@/lib/picks/week-query-param";

import { PicksPreviewBanner } from "@/components/picks/PicksPreviewBanner";
import { WeekMatchupList } from "@/components/picks/WeekMatchupList";

type PageProps = {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaguePicksPage({ params, searchParams }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership || !isLeagueParticipantRole(membership.role)) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });

  if (!league) {
    notFound();
  }

  const sp = await searchParams;
  const explicitWeekParsed = parseWeekNumberSearchParam(sp?.weekNumber);
  if (explicitWeekParsed === null) {
    notFound();
  }

  let picksView: BuildLeaguePicksWeekViewOutcome;
  try {
    picksView = await buildLeaguePicksWeekView({
      leagueId,
      sessionUserId: session.user.id,
      explicitWeekNumber: explicitWeekParsed ?? null,
    });
  } catch {
    notFound();
  }

  if (!picksView.ok) {
    notFound();
  }

  const { payload } = picksView;

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: { xs: 1.5, sm: 2 },
        py: { xs: 3, md: 4 },
        maxWidth: 640,
        mx: "auto",
        alignItems: "stretch",
      }}
    >
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>

      <Typography variant="h4" component="h1">
        Weekly picks
      </Typography>

      {payload.isPreview ? <PicksPreviewBanner /> : null}

      <WeekMatchupList
        weekLabel={payload.weekNumber}
        matchups={payload.matchups}
        pickDeadlineUtc={payload.pickDeadlineUtc}
        jailedTeamId={payload.jailedTeamId}
      />
    </Stack>
  );
}
