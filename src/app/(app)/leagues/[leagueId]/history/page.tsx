import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { PickHistoryTable } from "@/components/history/PickHistoryTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getPersonalPickHistory } from "@/lib/scoring/get-personal-pick-history";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueHistoryPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || !isLeagueParticipantRole(access.membership.role)) {
    notFound();
  }
  const { membership } = access;
  const nflSeasonYear = getCurrentNflSeasonYear();
  const history = await getPersonalPickHistory(prisma, {
    leagueId,
    nflSeasonYear,
    membershipId: membership.id,
  });

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
        My Picks
      </Typography>

      <PickHistoryTable history={history} />
    </Stack>
  );
}
