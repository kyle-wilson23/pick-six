import { describe, expect, it } from "vitest";

import {
  inferNflWeekNumber,
  mapOddsEventsToScheduleUpserts,
  week1TuesdayEtMs,
} from "./map-schedule-from-events";

const TEAMS = [
  { id: "phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
  { id: "dal", abbreviation: "DAL", name: "Dallas Cowboys" },
  { id: "kc", abbreviation: "KC", name: "Kansas City Chiefs" },
  { id: "lac", abbreviation: "LAC", name: "Los Angeles Chargers" },
];

describe("week1TuesdayEtMs / inferNflWeekNumber", () => {
  it("places a Thursday kickoff in week 1 and the next Thursday in week 2", () => {
    // 2026-09-10 Thu ~20:15 ET = 2026-09-11T00:15:00Z (sample Odds slate)
    const week1Kickoff = new Date("2026-09-11T00:15:00.000Z");
    const week1Tue = week1TuesdayEtMs(week1Kickoff);
    expect(inferNflWeekNumber(week1Kickoff, week1Tue)).toBe(1);

    const week2Kickoff = new Date("2026-09-18T00:15:00.000Z");
    expect(inferNflWeekNumber(week2Kickoff, week1Tue)).toBe(2);
  });
});

describe("mapOddsEventsToScheduleUpserts", () => {
  it("maps two weeks of events with home/away team ids", () => {
    const mapped = mapOddsEventsToScheduleUpserts(
      [
        {
          id: "e1",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-11T00:15:00Z",
          home_team: "Philadelphia Eagles",
          away_team: "Dallas Cowboys",
        },
        {
          id: "e2",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-18T00:15:00Z",
          home_team: "Kansas City Chiefs",
          away_team: "Los Angeles Chargers",
        },
      ],
      2026,
      TEAMS,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.rows).toHaveLength(2);
    expect(mapped.rows.find((r) => r.weekNumber === 1)).toMatchObject({
      homeTeamId: "phi",
      awayTeamId: "dal",
    });
    expect(mapped.rows.find((r) => r.weekNumber === 2)).toMatchObject({
      homeTeamId: "kc",
      awayTeamId: "lac",
    });
  });

  it("fails when a team name is unknown", () => {
    const mapped = mapOddsEventsToScheduleUpserts(
      [
        {
          id: "e1",
          sport_key: "americanfootball_nfl",
          commence_time: "2026-09-11T00:15:00Z",
          home_team: "Philadelphia Eagles",
          away_team: "Atlantis Atlanteans",
        },
      ],
      2026,
      TEAMS,
    );
    expect(mapped.ok).toBe(false);
    if (mapped.ok) return;
    expect(mapped.errors[0]?.message).toBe("unknown_team");
  });
});
