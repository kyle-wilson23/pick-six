import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { TestLeagueBanner } from "@/components/league/TestLeagueBanner";
import { TestLeagueChip } from "@/components/league/TestLeagueChip";
import { LeagueHubQuickActions } from "@/components/league/LeagueHubQuickActions";
import { UserIdentityCell } from "@/components/user/UserIdentityCell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { describeSeasonForParticipant } from "@/lib/league/list-joined-leagues";
import { listLeagueRoster } from "@/lib/league/list-league-roster";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueHomePage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access) {
    notFound();
  }

  const { league } = access;

  const nflSeasonYear = getCurrentNflSeasonYear();
  const seasonRow = await resolveCurrentSeasonForLeague(prisma.season, leagueId, nflSeasonYear);
  const season =
    seasonRow === null
      ? null
      : {
          id: seasonRow.id,
          nflSeasonYear: seasonRow.nflSeasonYear,
          firstCompetitionWeek: seasonRow.firstCompetitionWeek,
          firstCompetitionWeekLockedAt: seasonRow.firstCompetitionWeekLockedAt,
          preSeasonInitializedAt: seasonRow.preSeasonInitializedAt,
          updatedAt: seasonRow.updatedAt,
        };

  const roster = await listLeagueRoster(leagueId);

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
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h4" component="h1">
          {league.name}
        </Typography>
        {league.isTestLeague ? <TestLeagueChip size="medium" /> : null}
      </Stack>

      {league.isTestLeague ? <TestLeagueBanner /> : null}

      <LeagueHubQuickActions
        leagueId={leagueId}
        seasonDescription={describeSeasonForParticipant({ nflSeasonYear, season })}
      />

      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2">
          Roster
        </Typography>
        {roster.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No members appear on the roster yet. If you expected people here, try refreshing or ask a
            league admin.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Everyone in this league ({roster.length}{" "}
              {roster.length === 1 ? "member" : "members"}).
            </Typography>
            <Stack spacing={1.5}>
              {roster.map((entry) => (
                <Paper key={entry.membershipId} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={0.5}>
                    <UserIdentityCell
                      displayName={entry.displayName}
                      imageUrl={entry.imageUrl}
                      typographyVariant="body1"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {entry.role}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Stack>
  );
}
