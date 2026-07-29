import { describe, expect, it } from "vitest";

import { describeSeasonForParticipant } from "./describe-season-for-participant";

describe("describeSeasonForParticipant", () => {
  it("uses participant-friendly copy when the season row is missing", () => {
    const line = describeSeasonForParticipant({ nflSeasonYear: 2026, season: null });
    expect(line).toContain("does not have season details");
    expect(line).toContain("2026");
    expect(line).toContain("league admin");
  });

  it("notes NFL week when first competition week is after week 1", () => {
    const line = describeSeasonForParticipant({
      nflSeasonYear: 2026,
      season: {
        nflSeasonYear: 2026,
        firstCompetitionWeek: 5,
        firstCompetitionWeekLockedAt: null,
        preSeasonInitializedAt: null,
      },
    });
    expect(line).toContain("Competition starts NFL Week 5");
  });

  it("notes when competition start is locked", () => {
    const line = describeSeasonForParticipant({
      nflSeasonYear: 2026,
      season: {
        nflSeasonYear: 2026,
        firstCompetitionWeek: 1,
        firstCompetitionWeekLockedAt: new Date("2026-09-15T00:00:00.000Z"),
        preSeasonInitializedAt: null,
      },
    });
    expect(line).toContain("Competition start is locked");
  });
});
