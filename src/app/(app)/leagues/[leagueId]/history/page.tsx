import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { PickHistoryTable } from "@/components/history/PickHistoryTable";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { getPersonalPickHistory } from "@/lib/scoring/get-personal-pick-history";
import { appContentWidthSx } from "@/theme/app-content-width";
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
  if (!access) {
    notFound();
  }
  const nflSeasonYear = getCurrentNflSeasonYear();
  const history = access.isParticipant && access.membership
    ? await getPersonalPickHistory(prisma, {
        leagueId,
        nflSeasonYear,
        membershipId: access.membership.id,
      })
    : { entries: [], totalPoints: 0, wins: 0, losses: 0, ties: 0 };

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
        My Picks
      </Typography>

      <PickHistoryTable history={history} />
    </Stack>
  );
}
