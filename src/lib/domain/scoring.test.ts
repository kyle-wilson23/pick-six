import { describe, expect, it } from "vitest";

import { getGameWinner } from "./scoring";

const HOME = "team-home";
const AWAY = "team-away";

describe("getGameWinner", () => {
  it("returns home win when homeScore > awayScore", () => {
    expect(getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 27, awayScore: 20 })).toEqual({
      kind: "win",
      winnerId: HOME,
      loserId: AWAY,
    });
  });

  it("returns away win when awayScore > homeScore", () => {
    expect(getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 14, awayScore: 21 })).toEqual({
      kind: "win",
      winnerId: AWAY,
      loserId: HOME,
    });
  });

  it("returns tie when scores are equal", () => {
    expect(getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 24, awayScore: 24 })).toEqual({
      kind: "tie",
      teamIds: [HOME, AWAY],
    });
  });

  it("throws when either score is null", () => {
    expect(() =>
      getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: null as unknown as number, awayScore: 10 }),
    ).toThrow("getGameWinner requires non-null scores");
    expect(() =>
      getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 10, awayScore: null as unknown as number }),
    ).toThrow("getGameWinner requires non-null scores");
  });
});
