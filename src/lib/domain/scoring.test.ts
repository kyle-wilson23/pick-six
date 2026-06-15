import { describe, expect, it } from "vitest";

import { getGameWinner, scorePickOutcome } from "./scoring";

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

describe("scorePickOutcome", () => {
  const homeWin = getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 27, awayScore: 20 });
  const awayWin = getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 14, awayScore: 21 });
  const tie = getGameWinner({ homeTeamId: HOME, awayTeamId: AWAY, homeScore: 24, awayScore: 24 });

  it("returns WIN with 1 point for standard win", () => {
    expect(scorePickOutcome({ teamId: HOME, antiJailedBonus: false }, homeWin)).toEqual({
      outcome: "WIN",
      pointsEarned: 1,
    });
  });

  it("returns WIN with 2 points for anti-jailed win", () => {
    expect(scorePickOutcome({ teamId: AWAY, antiJailedBonus: true }, awayWin)).toEqual({
      outcome: "WIN",
      pointsEarned: 2,
    });
  });

  it("returns LOSS with 0 points for standard loss", () => {
    expect(scorePickOutcome({ teamId: AWAY, antiJailedBonus: false }, homeWin)).toEqual({
      outcome: "LOSS",
      pointsEarned: 0,
    });
  });

  it("returns LOSS with 0 points for anti-jailed loss", () => {
    expect(scorePickOutcome({ teamId: AWAY, antiJailedBonus: true }, homeWin)).toEqual({
      outcome: "LOSS",
      pointsEarned: 0,
    });
  });

  it("returns TIE with 0 points when antiJailedBonus is false", () => {
    expect(scorePickOutcome({ teamId: HOME, antiJailedBonus: false }, tie)).toEqual({
      outcome: "TIE",
      pointsEarned: 0,
    });
  });

  it("returns TIE with 0 points when antiJailedBonus is true", () => {
    expect(scorePickOutcome({ teamId: HOME, antiJailedBonus: true }, tie)).toEqual({
      outcome: "TIE",
      pointsEarned: 0,
    });
  });
});
