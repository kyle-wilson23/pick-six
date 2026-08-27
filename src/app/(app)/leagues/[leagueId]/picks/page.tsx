import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { buildLeaguePicksWeekView } from "@/lib/picks/build-league-picks-week-view";
import type { BuildLeaguePicksWeekViewOutcome } from "@/lib/picks/build-league-picks-week-view";
import {
  getLeagueWeekPeerPicks,
  isLeagueWeekPeerPicksUnlocked,
  type LeagueWeekPeerPickRow,
} from "@/lib/picks/get-league-week-peer-picks";
import { parseWeekNumberSearchParam } from "@/lib/picks/week-query-param";

import { TestLeagueBanner } from "@/components/league/TestLeagueBanner";
import { DeadlineCountdown } from "@/components/picks/DeadlineCountdown";
import { JailedTeamCallout } from "@/components/picks/JailedTeamCallout";
import { PicksPageTabs } from "@/components/picks/PicksPageTabs";
import { PicksPreviewBanner } from "@/components/picks/PicksPreviewBanner";
import { WeekMatchupList } from "@/components/picks/WeekMatchupList";
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

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

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || !isLeagueParticipantRole(access.membership.role)) {
    notFound();
  }

  const sp = await searchParams;
  const explicitWeekParsed = parseWeekNumberSearchParam(sp?.weekNumber);
  if (explicitWeekParsed === null) {
    notFound();
  }

  const now = new Date();

  let picksView: BuildLeaguePicksWeekViewOutcome;
  try {
    picksView = await buildLeaguePicksWeekView({
      leagueId,
      sessionUserId: session.user.id,
      explicitWeekNumber: explicitWeekParsed ?? null,
    }, now);
  } catch {
    notFound();
  }

  if (!picksView.ok) {
    notFound();
  }

  const { payload } = picksView;
  const showActiveWeekChrome = !payload.isPreview;

  // Locate the jailed team's metadata in the matchup list (so we can render the callout without
  // a second DB query).
  let jailedTeam: { id: string; abbreviation: string; name: string } | null = null;
  let jailedTeamMl: number | null = null;
  if (showActiveWeekChrome && payload.jailedTeamId != null) {
    for (const m of payload.matchups) {
      if (m.homeTeam.id === payload.jailedTeamId) {
        jailedTeam = m.homeTeam;
        jailedTeamMl = m.homeMoneylineAmerican;
        break;
      }
      if (m.awayTeam.id === payload.jailedTeamId) {
        jailedTeam = m.awayTeam;
        jailedTeamMl = m.awayMoneylineAmerican;
        break;
      }
    }
  }

  const showDeadline = showActiveWeekChrome && payload.pickDeadlineUtc != null;
  const showJailed = showActiveWeekChrome && jailedTeam != null;
  const showDeadlineJailedRow = showDeadline || showJailed;

  let opponentsRows: LeagueWeekPeerPickRow[] | null = null;
  if (
    isLeagueWeekPeerPicksUnlocked({
      isPreview: payload.isPreview,
      pickDeadlineUtc: payload.pickDeadlineUtc,
      now,
    })
  ) {
    const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId);
    if (season) {
      opponentsRows = await getLeagueWeekPeerPicks(prisma, {
        leagueId,
        seasonId: season.id,
        weekNumber: payload.weekNumber,
        isPreview: payload.isPreview,
        pickDeadlineUtc: payload.pickDeadlineUtc,
        now,
      });
    }
  }

  const myPickContent = (
    <Stack spacing={3}>
      {access.league.isTestLeague ? <TestLeagueBanner /> : null}

      {payload.isPreview ? <PicksPreviewBanner /> : null}

      {showDeadlineJailedRow ? (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="stretch"
        >
          {showDeadline ? (
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <DeadlineCountdown pickDeadlineUtc={payload.pickDeadlineUtc!} />
            </Stack>
          ) : null}
          {showJailed ? (
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <JailedTeamCallout team={jailedTeam!} moneylineAmerican={jailedTeamMl} />
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      <WeekMatchupList
        weekLabel={payload.weekNumber}
        weekNumber={payload.weekNumber}
        leagueId={leagueId}
        matchups={payload.matchups}
        teamsOnBye={payload.teamsOnBye}
        pickDeadlineUtc={payload.pickDeadlineUtc}
        jailedTeamId={payload.jailedTeamId}
        isPreview={payload.isPreview}
        currentPick={payload.currentPick}
        seasonPickedTeams={payload.seasonPickedTeams}
      />
    </Stack>
  );

  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        ...skipTargetMainSx,
        ...appContentWidthSx,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 3, md: 4 },
        alignItems: "stretch",
      }}
    >
      <Typography variant="h4" component="h1">
        Weekly picks
      </Typography>

      <PicksPageTabs opponentsRows={opponentsRows} myPickContent={myPickContent} />
    </Stack>
  );
}
