import { LeagueMembershipRole } from "@prisma/client";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";

import { InviteParticipantsForm } from "./invite-participants-form";
import { MarkLeagueReadySection } from "./mark-league-ready-section";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueInvitesPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId },
    },
  });

  if (!membership) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const season = await prisma.season.findUnique({
    where: { leagueId_nflSeasonYear: { leagueId, nflSeasonYear } },
    select: { preSeasonInitializedAt: true },
  });

  const isAdmin = membership.role === LeagueMembershipRole.ADMIN;

  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        ...skipTargetMainSx,
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 560,
        mx: "auto",
      }}
    >
      <Typography variant="h4" component="h1">
        Invite participants
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Paste or type email addresses (comma, semicolon, or newline separated). Each person receives
        an invitation email with a signup link.
      </Typography>
      <MarkLeagueReadySection
        leagueId={leagueId}
        isAdmin={isAdmin}
        initialPreSeasonInitializedAt={season?.preSeasonInitializedAt?.toISOString() ?? null}
        seasonRowExists={season !== null}
      />
      <InviteParticipantsForm leagueId={leagueId} />
    </Stack>
  );
}
