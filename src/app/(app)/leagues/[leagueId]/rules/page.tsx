import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLeagueAccess } from '@/lib/league/get-league-access';
import { isLeagueParticipantRole } from '@/lib/league/participant-membership';
import { getCurrentNflSeasonYear } from '@/lib/league/nfl-season';
import { resolveCurrentSeasonForLeague } from '@/lib/league/resolve-current-season';
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueRulesPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || !isLeagueParticipantRole(access.membership.role)) {
    notFound();
  }

  const { league } = access;

  const nflSeasonYear = getCurrentNflSeasonYear();
  const season = await resolveCurrentSeasonForLeague(prisma.season, leagueId, nflSeasonYear);
  const firstWeek = season?.firstCompetitionWeek ?? 1;

  return (
    <Stack
      component='main'
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
        How scoring, deadlines, and picks work in {league.name}. The same
        rules apply to everyone and can&apos;t be customized in the app.
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
            Pick a team that wins on the scoreboard and you earn{' '}
            <strong>1 point</strong>. If your pick is the opponent of the{' '}
            <strong>jailed team</strong> and that opponent wins, you earn{' '}
            <strong>2 points</strong> for that week (not 1).
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
            Each week, one NFL team is the <strong>jailed team</strong>—the
            biggest favorite by <strong>moneyline</strong> among that
            week&apos;s favorites, based on a <strong>locked weekly odds</strong>{' '}
            snapshot. Everyone in the league uses the same snapshot, so the
            jailed team is the same for all participants.
          </Typography>
        </section>

        <section>
          <Typography
            variant='h6'
            component='h2'
            gutterBottom
          >
            When more than one team could be jailed
          </Typography>
          <Typography
            variant='body1'
            component='p'
          >
            Break ties in this order: <strong>moneyline</strong> first (biggest
            favorite), then <strong>point spread</strong> in the
            favorite&apos;s favor, then a <strong>seeded random</strong> choice
            from the remaining teams. The seed and result are recorded so the
            outcome can be verified later if needed.
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
            season. Each of your picks must be a different team.
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
            Picks for a week open on the <strong>Tuesday</strong> before its
            first game, and lock{' '}
            <strong>5 minutes before the first kickoff</strong> of the NFL week.
            Lock times are based on the real kickoff schedule.
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
            After the weekly pick deadline, other participants&apos; picks become
            visible on the Picks page (Opponents tab) so you can follow along
            during the weekend. Standings and scored results update on{' '}
            <strong>Tuesday</strong> after Monday Night Football is processed.
          </Typography>
        </section>
      </Stack>
    </Stack>
  );
}
