import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { AdminLeagueRowActions } from "@/components/leagues/admin-league-row-actions";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { describeSeasonForParticipant } from "@/lib/league/list-joined-leagues";
import { listLeagueRoster } from "@/lib/league/list-league-roster";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
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
  if (!access || !isLeagueParticipantRole(access.membership.role)) {
    notFound();
  }

  const { membership, league } = access;

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
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 560,
        mx: "auto",
        ...skipTargetMainSx,
      }}
    >
      <Stack component="nav" aria-label="Breadcrumb">
        <Typography variant="body2" component="span">
          <Link href="/my-leagues">
            <span aria-hidden="true">← </span>
            Your leagues
          </Link>
        </Typography>
      </Stack>

      <Typography variant="h4" component="h1">
        {league.name}
      </Typography>

      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          Season
        </Typography>
        <Typography variant="body1">
          {describeSeasonForParticipant({ nflSeasonYear, season })}
        </Typography>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          League hub
        </Typography>
        <Link href={`/leagues/${leagueId}/picks`}>Weekly picks</Link>
        <Link href={`/leagues/${leagueId}/standings`}>Standings</Link>
        <Link href={`/leagues/${leagueId}/history`}>History</Link>
        <Link href={`/leagues/${leagueId}/results`}>Results</Link>
        <Link href={`/leagues/${leagueId}/rules`}>League rules</Link>
      </Stack>

      {membership.role === LeagueMembershipRole.ADMIN ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Admin
          </Typography>
          <AdminLeagueRowActions leagueId={leagueId} />
        </Stack>
      ) : null}

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
                    <Typography variant="body1">{entry.displayName}</Typography>
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
