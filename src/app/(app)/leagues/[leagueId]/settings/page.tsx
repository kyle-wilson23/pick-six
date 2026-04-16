import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentNflSeasonYear } from "@/lib/league/nfl-season";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueSettingsPage({ params }: PageProps) {
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

  if (membership.role !== LeagueMembershipRole.ADMIN) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, createdAt: true },
  });

  if (!league) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId, nflSeasonYear);

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
        <Link href="/leagues">← Back to leagues you administer</Link>
      </Typography>
      <Typography variant="h4" component="h1">
        League settings
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Read-only summary. Editing and destructive actions will arrive in later stories.
      </Typography>

      <Stack spacing={1} sx={{ "& dt": { fontWeight: 600 }, "& dd": { margin: 0 } }}>
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
          <Typography component="dt" variant="subtitle2">
            First competition week
          </Typography>
          <Typography component="dd" variant="body1">
            {season ? season.firstCompetitionWeek : "— (no season row for this year)"}
          </Typography>
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
    </Stack>
  );
}
