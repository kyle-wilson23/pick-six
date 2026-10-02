import type { NflGameStatus } from "@prisma/client";

import { isWeekInLeagueCompetition } from "@/lib/nfl/nfl-regular-season";
import { isWeekFullyFinalized } from "@/lib/scoring/finalize-nfl-week";

export {
  formatWinLossRecord,
  tallySeasonRecordsFromRevealedWeeks,
  type RevealedWeekForRecord,
  type SeasonRecordTally,
} from "./format-win-loss-record";

/**
 * Competition weeks that have at least one game and are fully finalized.
 * An empty game list is not a finalized week (`isWeekFullyFinalized([])` is true).
 */
export function finalizedCompetitionWeekNumbers(
  games: ReadonlyArray<{ weekNumber: number; status: NflGameStatus }>,
  firstCompetitionWeek: number,
): number[] {
  const gamesByWeek = new Map<number, Array<{ status: NflGameStatus }>>();
  for (const game of games) {
    const weekGames = gamesByWeek.get(game.weekNumber);
    if (weekGames) {
      weekGames.push(game);
    } else {
      gamesByWeek.set(game.weekNumber, [game]);
    }
  }

  const weeks: number[] = [];
  for (const [weekNumber, weekGames] of gamesByWeek) {
    if (weekGames.length === 0) continue;
    if (!isWeekInLeagueCompetition({ firstCompetitionWeek }, weekNumber)) continue;
    if (!isWeekFullyFinalized(weekGames)) continue;
    weeks.push(weekNumber);
  }
  weeks.sort((a, b) => a - b);
  return weeks;
}

/** Finalized competition weeks that have no Pick row. A saved pick is not a miss. */
export function countMissedWeeks(
  finalizedCompetitionWeeks: readonly number[],
  pickedWeekNumbers: readonly number[],
): number {
  const picked = new Set(pickedWeekNumbers);
  const seen = new Set<number>();
  let missed = 0;
  for (const week of finalizedCompetitionWeeks) {
    if (seen.has(week)) continue;
    seen.add(week);
    if (!picked.has(week)) missed += 1;
  }
  return missed;
}
