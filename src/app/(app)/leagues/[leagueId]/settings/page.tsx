import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";

import { DeleteLeagueDialog } from "./delete-league-dialog";
import { FirstCompetitionWeekSettings } from "./first-competition-week-settings";
import { NflOddsAdminPanel } from "./nfl-odds-admin-panel";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueSettingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || access.membership.role !== LeagueMembershipRole.ADMIN) {
    notFound();
  }

  const { league } = access;

  const nflSeasonYear = getCurrentNflSeasonYear();
  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId, nflSeasonYear);

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
      <Typography variant="body2">
        <Link href="/leagues">← Back to leagues you administer</Link>
      </Typography>
      <Typography variant="h4" component="h1">
        League settings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Read-only summary for most fields. You can adjust the first competition week below until competition has
        started for this season. Permanent league deletion is available below.
      </Typography>

      <Stack spacing={2.5} sx={{ "& dt": { fontWeight: 600 }, "& dd": { margin: 0 } }}>
        <div>
          <Typography component="dt" variant="subtitle2">
            League name
          </Typography>
          <Typography component="dd" variant="body1">
            {league.name}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="subtitle2">
            League id
          </Typography>
          <Typography component="dd" variant="body1" sx={{ wordBreak: "break-all", fontFamily: "monospace" }}>
            {league.id}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="subtitle2">
            Current NFL season year (app)
          </Typography>
          <Typography component="dd" variant="body1">
            {nflSeasonYear}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="subtitle2" gutterBottom id="nfl-odds-admin-label">
            NFL odds (global)
          </Typography>
          <NflOddsAdminPanel
            defaultNflSeasonYear={nflSeasonYear}
            firstCompetitionWeek={season?.firstCompetitionWeek ?? null}
          />
        </div>
        <div>
          <Typography
            component="dt"
            variant="subtitle2"
            gutterBottom
            id="first-competition-week-settings-label"
          >
            First competition week
          </Typography>
          <FirstCompetitionWeekSettings
            key={`fcw-${season?.firstCompetitionWeek ?? "none"}-${season?.firstCompetitionWeekLockedAt?.toISOString() ?? "open"}`}
            leagueId={leagueId}
            hasSeason={season !== null}
            initialFirstCompetitionWeek={season?.firstCompetitionWeek ?? 1}
            initialFirstCompetitionWeekLockedAt={
              season?.firstCompetitionWeekLockedAt?.toISOString() ?? null
            }
          />
        </div>
        <div>
          <Typography component="dt" variant="subtitle2">
            Pre-season initialized at
          </Typography>
          <Typography component="dd" variant="body1">
            {season?.preSeasonInitializedAt
              ? `${season.preSeasonInitializedAt.toISOString()} (${season.preSeasonInitializedAt.toLocaleString()})`
              : season
                ? "Not yet initialized"
                : "—"}
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="subtitle2">
            League created at
          </Typography>
          <Typography component="dd" variant="body1">
            {league.createdAt.toISOString()} ({league.createdAt.toLocaleString()})
          </Typography>
        </div>
        <div>
          <Typography component="dt" variant="subtitle2">
            Season last updated
          </Typography>
          <Typography component="dd" variant="body1">
            {season
              ? `${season.updatedAt.toISOString()} (${season.updatedAt.toLocaleString()})`
              : "—"}
          </Typography>
        </div>
      </Stack>

      <Stack sx={{ mt: 6, pt: 1 }}>
        <DeleteLeagueDialog leagueId={leagueId} leagueName={league.name} />
      </Stack>
    </Stack>
  );
}
