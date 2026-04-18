import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

/** Canonical participant weekly-picks entry (Story 2.6); full UI lands in Epic 3. */
export default async function LeaguePicksPlaceholderPage({ params }: PageProps) {
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
        Weekly picks
      </Typography>

      <Typography variant="body1" color="text.secondary">
        Weekly picks, matchups, and odds will be available here in a future release (Epic 3). You
        have full participant access to this league as{" "}
        {membership.role === LeagueMembershipRole.ADMIN ? "an admin" : "a member"}.
      </Typography>
    </Stack>
  );
}
