import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isLeagueParticipantRole } from '@/lib/league/participant-membership';
import { getCurrentNflSeasonYear } from '@/lib/league/nfl-season';
import { resolveCurrentSeasonForLeague } from '@/lib/league/resolve-current-season';

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueRulesPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership) {
    notFound();
  }

  if (!isLeagueParticipantRole(membership.role)) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });

  if (!league) {
    notFound();
  }

  const nflSeasonYear = getCurrentNflSeasonYear();
  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId, nflSeasonYear);
  const firstWeek = season?.firstCompetitionWeek ?? 1;

  return (
    <Stack
      component='main'
      spacing={3}
      sx={{
        minHeight: '100vh',
        px: 2,
        py: 4,
        maxWidth: 640,
        mx: 'auto',
      }}
    >
      <Typography variant='body2'>
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>

      <Typography
        variant='h4'
        component='h1'
      >
        League rules
      </Typography>
      <Typography
        variant='body2'
        color='text.secondary'
      >
        Reference for {league.name}. These mechanics are fixed for the MVP;
        admins cannot customize scoring or deadlines in the app yet.
      </Typography>

      <Stack
        spacing={2}
        sx={{ '& h2': { mt: 0 } }}
      >
        {firstWeek > 1 ? (
          <section>
            <Typography variant='h6' component='h2' gutterBottom>
              Season start
            </Typography>
            <Typography variant='body1' component='p'>
              Competition for this league begins at <strong>NFL Week {firstWeek}</strong>. NFL regular-season weeks
              before that week are not part of this league’s competition: no picks, no points, and no retroactive
              scoring for those weeks.
            </Typography>
          </section>
        ) : null}

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Scoring
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            A standard win is picking a team that wins on the scoreboard. That
            earns <strong>1 point</strong>. Picking correctly{' '}
            <strong>against the jailed team</strong> earns{' '}
            <strong>2 points</strong> for that week.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Jailed team
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            Each week, one NFL team is the <strong>jailed team</strong>: the
            biggest favorite by moneyline at the league&apos;s weekly odds
            snapshot. Picks are evaluated against that designation for
            anti-jailed bonuses and validation.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Tie-breakers
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            Order is: <strong>spread-based resolution</strong> first, then a{' '}
            <strong>seeded random</strong> process with an{' '}
            <strong>audit trail</strong> so results can be verified later.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Unique teams
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            You may not pick the <strong>same NFL team twice</strong> in one
            season; each participant&apos;s picks must stay unique across the
            season.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Weekly deadline
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            Picks lock <strong>5 minutes before the first kickoff</strong> of
            the NFL week—typically Thursday around{' '}
            <strong>8:10 PM Eastern</strong> when the week opens on Thursday
            night, or earlier if the first game is sooner. The server enforces
            the real kickoff schedule.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            Standings and pick visibility
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            <strong>Tuesday standings and peer picks:</strong> league standings
            update after Monday Night Football is processed. Until that Tuesday
            reveal, other participants&apos; picks stay hidden.
          </Typography>
        </section>
      </Stack>
    </Stack>
  );
}
