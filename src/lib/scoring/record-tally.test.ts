import type { NflGameStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  countMissedWeeks,
  finalizedCompetitionWeekNumbers,
  formatWinLossRecord,
  tallySeasonRecordsFromRevealedWeeks,
} from "./record-tally";

function game(weekNumber: number, status: NflGameStatus) {
  return { weekNumber, status };
}

describe("finalizedCompetitionWeekNumbers", () => {
  it("returns an empty list when there are no games", () => {
    expect(finalizedCompetitionWeekNumbers([], 1)).toEqual([]);
  });

  it("includes a competition week only when every game is finalized", () => {
    expect(
      finalizedCompetitionWeekNumbers(
        [
          game(1, "FINAL"),
          game(1, "CANCELLED"),
          game(2, "FINAL"),
          game(2, "SCHEDULED"),
          game(3, "IN_PROGRESS"),
        ],
        1,
      ),
    ).toEqual([1]);
  });

  it("skips weeks before firstCompetitionWeek", () => {
    expect(
      finalizedCompetitionWeekNumbers([game(1, "FINAL"), game(2, "FINAL"), game(3, "FINAL")], 3),
    ).toEqual([3]);
  });

  it("skips weeks outside the regular season", () => {
    expect(finalizedCompetitionWeekNumbers([game(0, "FINAL"), game(19, "FINAL")], 1)).toEqual([]);
  });
});

describe("countMissedWeeks", () => {
  it("counts Jack as one miss with zero valid losses in the record string", () => {
    const finalized = finalizedCompetitionWeekNumbers(
      [game(1, "FINAL"), game(2, "FINAL"), game(3, "FINAL")],
      1,
    );
    const missedWeeks = countMissedWeeks(finalized, [1, 3]);

    expect(missedWeeks).toBe(1);
    expect(
      formatWinLossRecord({ wins: 2, validLosses: 0, ties: 0, missedWeeks }),
    ).toBe("2-1");
  });

  it("adds a scored loss and a miss as two record losses while valid losses stay 1", () => {
    const missedWeeks = countMissedWeeks([1, 2], [1]);

    expect(missedWeeks).toBe(1);
    expect(
      formatWinLossRecord({ wins: 0, validLosses: 1, ties: 0, missedWeeks }),
    ).toBe("0-2");
  });

  it("does not count an open week", () => {
    const finalized = finalizedCompetitionWeekNumbers(
      [game(1, "FINAL"), game(2, "SCHEDULED")],
      1,
    );

    expect(finalized).toEqual([1]);
    expect(countMissedWeeks(finalized, [1])).toBe(0);
  });

  it("does not count a finalized week before firstCompetitionWeek", () => {
    const finalized = finalizedCompetitionWeekNumbers(
      [game(1, "FINAL"), game(2, "FINAL")],
      2,
    );

    expect(countMissedWeeks(finalized, [2])).toBe(0);
  });

  it("does not count a week that has a saved pick, even when that pick is unscored", () => {
    expect(countMissedWeeks([1, 2], [1, 2])).toBe(0);
    expect(
      formatWinLossRecord({ wins: 1, validLosses: 0, ties: 0, missedWeeks: 0 }),
    ).toBe("1-0");
  });

  it("counts a duplicate finalized week once", () => {
    expect(countMissedWeeks([2, 2], [])).toBe(1);
  });
});

describe("formatWinLossRecord", () => {
  it("includes the tie segment only when includeTies is set", () => {
    const tally = { wins: 1, validLosses: 0, ties: 1, missedWeeks: 0 };

    expect(formatWinLossRecord(tally)).toBe("1-0");
    expect(formatWinLossRecord(tally, { includeTies: true })).toBe("1-0-1");
  });

  it("folds missed weeks into L when a tie is shown", () => {
    expect(
      formatWinLossRecord(
        { wins: 2, validLosses: 0, ties: 1, missedWeeks: 1 },
        { includeTies: true },
      ),
    ).toBe("2-1-1");
  });
});

describe("tallySeasonRecordsFromRevealedWeeks", () => {
  it("tallies Jack as 2-1 from revealed wins and one revealed miss", () => {
    const records = tallySeasonRecordsFromRevealedWeeks([
      {
        isRevealed: true,
        entries: [{ membershipId: "jack", hasPick: true, outcome: "WIN" }],
      },
      {
        isRevealed: true,
        entries: [{ membershipId: "jack", hasPick: false, outcome: "PENDING" }],
      },
      {
        isRevealed: true,
        entries: [{ membershipId: "jack", hasPick: true, outcome: "WIN" }],
      },
      {
        isRevealed: false,
        entries: [{ membershipId: "jack", hasPick: false, outcome: "PENDING" }],
      },
    ]);

    const jack = records.get("jack");
    expect(jack).toEqual({ wins: 2, validLosses: 0, ties: 0, missedWeeks: 1 });
    expect(formatWinLossRecord(jack!)).toBe("2-1");
  });

  it("ignores PENDING saved picks and does not treat a miss as a valid loss", () => {
    const records = tallySeasonRecordsFromRevealedWeeks([
      {
        isRevealed: true,
        entries: [
          { membershipId: "jack", hasPick: true, outcome: "PENDING" },
          { membershipId: "jack", hasPick: false, outcome: "LOSS" },
          { membershipId: "peer", hasPick: true, outcome: "LOSS" },
          { membershipId: "peer", hasPick: true, outcome: "TIE" },
        ],
      },
    ]);

    expect(records.get("jack")).toEqual({
      wins: 0,
      validLosses: 0,
      ties: 0,
      missedWeeks: 1,
    });
    expect(records.get("peer")).toEqual({
      wins: 0,
      validLosses: 1,
      ties: 1,
      missedWeeks: 0,
    });
  });
});
