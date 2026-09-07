import { describe, expect, it } from "vitest";

import { easternLocal } from "@/test/season-2026-openers";

import {
  hasConcludedFirstCompetitionWeek,
  isTuesdayDigestComposerEnabled,
  lastKickoffForWeek,
} from "./has-concluded-first-competition-week";

/** 2026 Week 1: Wed opener + Monday-night closer (production slate). */
const WEEK_1_2026 = [
  { weekNumber: 1, kickoffAt: easternLocal(2026, 8, 9, 20, 15) },
  { weekNumber: 1, kickoffAt: easternLocal(2026, 8, 14, 20, 15) },
  { weekNumber: 2, kickoffAt: easternLocal(2026, 8, 17, 20, 15) },
];

const WEEK_1_LAST = easternLocal(2026, 8, 14, 20, 15);

describe("lastKickoffForWeek", () => {
  it("returns the latest kickoff for the requested week", () => {
    expect(lastKickoffForWeek(WEEK_1_2026, 1)).toEqual(WEEK_1_LAST);
  });

  it("returns null when that week has no games", () => {
    expect(lastKickoffForWeek(WEEK_1_2026, 12)).toBeNull();
    expect(lastKickoffForWeek([], 1)).toBeNull();
  });
});

describe("hasConcludedFirstCompetitionWeek", () => {
  it("false when the first competition week has no schedule rows", () => {
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 1,
        games: [{ weekNumber: 2, kickoffAt: easternLocal(2026, 8, 17, 20, 15) }],
        now: easternLocal(2026, 8, 15, 19, 0),
      }),
    ).toBe(false);
  });

  it("false on the Week 1 kickoff Tuesday (Sep 8) — slate has not finished", () => {
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 1,
        games: WEEK_1_2026,
        now: easternLocal(2026, 8, 8, 19, 0),
      }),
    ).toBe(false);
  });

  it("false at the last kickoff instant (strict >)", () => {
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 1,
        games: WEEK_1_2026,
        now: WEEK_1_LAST,
      }),
    ).toBe(false);
  });

  it("true once the first week's last kickoff is in the past", () => {
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 1,
        games: WEEK_1_2026,
        now: new Date(WEEK_1_LAST.getTime() + 1),
      }),
    ).toBe(true);
  });

  it("true on the Tuesday after Week 1 (Sep 15 digest night)", () => {
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 1,
        games: WEEK_1_2026,
        now: easternLocal(2026, 8, 15, 19, 0),
      }),
    ).toBe(true);
  });

  it("uses firstCompetitionWeek, not week 1 hardcoded — mid-season start", () => {
    const week12 = [
      { weekNumber: 12, kickoffAt: easternLocal(2026, 10, 25, 20, 0) },
      { weekNumber: 12, kickoffAt: easternLocal(2026, 10, 30, 20, 15) },
    ];
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 12,
        games: week12,
        now: easternLocal(2026, 10, 24, 19, 0),
      }),
    ).toBe(false);
    expect(
      hasConcludedFirstCompetitionWeek({
        firstCompetitionWeek: 12,
        games: week12,
        now: easternLocal(2026, 11, 1, 19, 0),
      }),
    ).toBe(true);
  });
});

describe("isTuesdayDigestComposerEnabled", () => {
  it("false for production before the first week concludes", () => {
    expect(
      isTuesdayDigestComposerEnabled({
        isTestLeague: false,
        hasConcludedFirstCompetitionWeek: false,
      }),
    ).toBe(false);
  });

  it("true for production after the first week concludes", () => {
    expect(
      isTuesdayDigestComposerEnabled({
        isTestLeague: false,
        hasConcludedFirstCompetitionWeek: true,
      }),
    ).toBe(true);
  });

  it("true for test leagues even before the first week concludes", () => {
    expect(
      isTuesdayDigestComposerEnabled({
        isTestLeague: true,
        hasConcludedFirstCompetitionWeek: false,
      }),
    ).toBe(true);
  });
});
