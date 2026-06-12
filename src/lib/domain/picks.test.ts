import { describe, expect, it } from "vitest";

import {
  ANTI_JAILED_UNAVAILABLE_MESSAGE,
  getOpponentOfJailedInWeek,
  teamPlaysInWeek,
  validateDuplicateTeamAcrossSeason,
  validateJailedLineupAndBonus,
} from "./picks";

const GAMES = [
  { homeTeamId: "h1", awayTeamId: "a1" },
  { homeTeamId: "h2", awayTeamId: "a2" },
];

const JAILED_TEAM_ON_BYE_ID = "jailed-on-bye";

describe("teamPlaysInWeek", () => {
  it("is true for home and away", () => {
    expect(teamPlaysInWeek("h1", GAMES)).toBe(true);
    expect(teamPlaysInWeek("a2", GAMES)).toBe(true);
  });

  it("is false for a team not playing", () => {
    expect(teamPlaysInWeek("x", GAMES)).toBe(false);
  });
});

describe("getOpponentOfJailedInWeek", () => {
  it("returns the other team in the jailed team’s game", () => {
    expect(getOpponentOfJailedInWeek("h1", GAMES)).toEqual({ ok: true, opponentTeamId: "a1" });
    expect(getOpponentOfJailedInWeek("a2", GAMES)).toEqual({ ok: true, opponentTeamId: "h2" });
  });

  it("fails when jailed is not in the list", () => {
    expect(getOpponentOfJailedInWeek("x", GAMES)).toEqual({ ok: false });
  });
});

describe("validateJailedLineupAndBonus", () => {
  it("rejects a direct jailed pick", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "h1",
      jailedTeamId: "h1",
      antiJailedBonus: false,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "JAILED_TEAM_PICK" } });
  });

  it("allows the opponent with antiJailedBonus true", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "a1",
      jailedTeamId: "h1",
      antiJailedBonus: true,
      games: GAMES,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects antiJailedBonus when team is not the jailed opponent", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "a2",
      jailedTeamId: "h1",
      antiJailedBonus: true,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "ANTI_JAILED_BONUS_INVALID" } });
  });

  it("allows picking the opponent with antiJailedBonus false (normal 1-pt underdog)", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "a1",
      jailedTeamId: "h1",
      antiJailedBonus: false,
      games: GAMES,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects team not in the week", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "lonely",
      jailedTeamId: "h1",
      antiJailedBonus: false,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "TEAM_NOT_IN_WEEK" } });
  });

  it("allows regular pick when jailed team has no game in week games", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "a1",
      jailedTeamId: JAILED_TEAM_ON_BYE_ID,
      antiJailedBonus: false,
      games: GAMES,
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects anti-jailed pick when jailed team has no game in week games", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "a1",
      jailedTeamId: JAILED_TEAM_ON_BYE_ID,
      antiJailedBonus: true,
      games: GAMES,
    });
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "JAILED_NOT_IN_WEEK_GAMES",
        message: ANTI_JAILED_UNAVAILABLE_MESSAGE,
      },
    });
  });

  it("rejects direct jailed pick even when jailed team has no game in week games", () => {
    const r = validateJailedLineupAndBonus({
      teamId: JAILED_TEAM_ON_BYE_ID,
      jailedTeamId: JAILED_TEAM_ON_BYE_ID,
      antiJailedBonus: false,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "JAILED_TEAM_PICK" } });
  });

  it("rejects jailed team pick even when antiJailedBonus is true", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "h1",
      jailedTeamId: "h1",
      antiJailedBonus: true,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "JAILED_TEAM_PICK" } });
  });

  it("rejects pick with antiJailedBonus true when teamId is not in games", () => {
    const r = validateJailedLineupAndBonus({
      teamId: "lonely",
      jailedTeamId: "h1",
      antiJailedBonus: true,
      games: GAMES,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "TEAM_NOT_IN_WEEK" } });
  });
});

describe("validateDuplicateTeamAcrossSeason", () => {
  it("fails when the team was used in another week", () => {
    const r = validateDuplicateTeamAcrossSeason("t1", ["t1", "t2"]);
    expect(r).toMatchObject({ ok: false, error: { code: "DUPLICATE_TEAM" } });
  });

  it("passes when the team is new for the season (other weeks)", () => {
    expect(validateDuplicateTeamAcrossSeason("t1", ["t2", "t3"])).toEqual({ ok: true });
  });
});
