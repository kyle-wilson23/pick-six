/**
 * Automated Tuesday digest waits until the league's first competition week has finished on the
 * schedule. The kickoff-week digest has no results yet; pick reminders and a commissioner
 * kickoff email cover that prompt.
 *
 * "Concluded" is last kickoff in the past (strict `>`). Tuesday cron fires ~23h after a typical
 * Monday-night closer, so this matches "at least one full NFL week is on the board" without
 * waiting on scoring finalize.
 */

export function lastKickoffForWeek(
  games: { weekNumber: number; kickoffAt: Date }[],
  weekNumber: number,
): Date | null {
  let latest: Date | null = null;
  for (const g of games) {
    if (g.weekNumber !== weekNumber) {
      continue;
    }
    if (latest == null || g.kickoffAt.getTime() > latest.getTime()) {
      latest = g.kickoffAt;
    }
  }
  return latest;
}

export function hasConcludedFirstCompetitionWeek(args: {
  firstCompetitionWeek: number;
  games: { weekNumber: number; kickoffAt: Date }[];
  now: Date;
}): boolean {
  const lastKickoff = lastKickoffForWeek(args.games, args.firstCompetitionWeek);
  if (lastKickoff == null) {
    return false;
  }
  return args.now.getTime() > lastKickoff.getTime();
}
