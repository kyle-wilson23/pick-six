import { describe, expect, it } from "vitest";

import { summarizeFinalizeWeekResult } from "./summarize-finalize-week";

describe("summarizeFinalizeWeekResult", () => {
  it("explains a skipped score when games are still open", () => {
    expect(
      summarizeFinalizeWeekResult({
        weekNumber: 1,
        allGamesFinalized: false,
        finalCount: 14,
        notFinalCount: 2,
        scored: 0,
        skipped: 0,
      }),
    ).toBe(
      "Week 1 not scored — 2 game(s) still not FINAL (14 final). Standings update only after every game is FINAL or CANCELLED.",
    );
  });

  it("reports pick scoring when the week is complete", () => {
    expect(
      summarizeFinalizeWeekResult({
        weekNumber: 1,
        allGamesFinalized: true,
        finalCount: 16,
        notFinalCount: 0,
        scored: 12,
        skipped: 2,
      }),
    ).toBe("Week 1 scored: 12 pick(s) scored, 2 skipped.");
  });
});
