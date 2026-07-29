import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";

import { HomeAdminLeaguesCard, HomeJoinedLeaguesCard } from "@/components/league/HomeLeagueCards";
import { CreateLeagueLinkButton } from "@/components/leagues/create-league-link-button";
import { auth } from "@/lib/auth";
import { buildLoginRedirectWithCallback } from "@/lib/callback-url";
import { listAdministeredLeaguesWithCurrentSeason } from "@/lib/league/list-administered-leagues";
import { listJoinedLeaguesWithCurrentSeason } from "@/lib/league/list-joined-leagues";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(buildLoginRedirectWithCallback("/home"));
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const [joinedRows, adminRows] = await Promise.all([
    listJoinedLeaguesWithCurrentSeason(userId, nflSeasonYear),
    listAdministeredLeaguesWithCurrentSeason(userId, nflSeasonYear),
  ]);

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
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h4" component="h1">
          Home
        </Typography>
        <CreateLeagueLinkButton />
      </Stack>

      <HomeJoinedLeaguesCard rows={joinedRows} nflSeasonYear={nflSeasonYear} />
      <HomeAdminLeaguesCard rows={adminRows} nflSeasonYear={nflSeasonYear} />
    </Stack>
  );
}
