import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

export type SeasonRecordTally = {
  wins: number;
  validLosses: number;
  ties: number;
  missedWeeks: number;
};

export type RevealedWeekForRecord = {
  isRevealed: boolean;
  entries: ReadonlyArray<{
    membershipId: string;
    hasPick: boolean;
    outcome: PickHistoryOutcome;
  }>;
};

const EMPTY_TALLY: SeasonRecordTally = {
  wins: 0,
  validLosses: 0,
  ties: 0,
  missedWeeks: 0,
};

/**
 * Per-player season tally from peer-history weeks.
 * Only revealed weeks count. `hasPick: false` is a miss. PENDING is ignored.
 */
export function tallySeasonRecordsFromRevealedWeeks(
  weeks: readonly RevealedWeekForRecord[],
): Map<string, SeasonRecordTally> {
  const byMember = new Map<string, SeasonRecordTally>();
  for (const week of weeks) {
    if (!week.isRevealed) continue;
    for (const entry of week.entries) {
      const current = byMember.get(entry.membershipId) ?? { ...EMPTY_TALLY };
      if (!entry.hasPick) {
        current.missedWeeks += 1;
      } else if (entry.outcome === "WIN") {
        current.wins += 1;
      } else if (entry.outcome === "LOSS") {
        current.validLosses += 1;
      } else if (entry.outcome === "TIE") {
        current.ties += 1;
      }
      byMember.set(entry.membershipId, current);
    }
  }
  return byMember;
}

/** `L` is valid losses plus missed weeks. `W-L`, or `W-L-T` when `includeTies`. */
export function formatWinLossRecord(
  tally: SeasonRecordTally,
  options?: { includeTies?: boolean },
): string {
  const losses = tally.validLosses + tally.missedWeeks;
  if (options?.includeTies) {
    return `${tally.wins}-${losses}-${tally.ties}`;
  }
  return `${tally.wins}-${losses}`;
}
