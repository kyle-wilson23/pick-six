import { describe, expect, it } from "vitest";

import {
  buildTeamLookup,
  includeRegularSeasonRow,
  kickoffUtcFromGameDate,
  mapApiSportsRowsToScheduleUpserts,
  normalizeProviderTeamCode,
  parseWeekNumber,
  resolveTeamId,
} from "./map-schedule";
import { apiSportsGamesEnvelopeSchema } from "./schemas";

describe("map-schedule", () => {
  const lookup = buildTeamLookup([
    { id: "team-kc", abbreviation: "KC", name: "Kansas City Chiefs" },
    { id: "team-buf", abbreviation: "BUF", name: "Buffalo Bills" },
    { id: "team-jax", abbreviation: "JAX", name: "Jacksonville Jaguars" },
  ]);

  it("parseWeekNumber accepts 1–18", () => {
    expect(parseWeekNumber("7")).toBe(7);
    expect(parseWeekNumber(12)).toBe(12);
    expect(parseWeekNumber("Wildcard")).toBe(null);
    expect(parseWeekNumber(19)).toBe(null);
  });

  it("normalizeProviderTeamCode applies aliases", () => {
    expect(normalizeProviderTeamCode("jac")).toBe("JAX");
  });

  it("includeRegularSeasonRow allows only 'Regular Season' or absent stage", () => {
    expect(includeRegularSeasonRow("Regular Season", 1)).toBe(true);
    expect(includeRegularSeasonRow("Pre Season", 2)).toBe(false);
    expect(includeRegularSeasonRow("Playoffs", 1)).toBe(false);
    expect(includeRegularSeasonRow(undefined, 3)).toBe(true);
    expect(includeRegularSeasonRow("Pro Bowl", 1)).toBe(false);
    expect(includeRegularSeasonRow("Hall of Fame", 1)).toBe(false);
  });

  it("kickoffUtcFromGameDate uses unix seconds", () => {
    const d = kickoffUtcFromGameDate({ timestamp: 1700000000 });
    expect(d?.toISOString()).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("kickoffUtcFromGameDate parses date+time strings as UTC", () => {
    const d = kickoffUtcFromGameDate({ date: "2026-09-07", time: "18:00" });
    expect(d?.toISOString()).toBe("2026-09-07T18:00:00.000Z");
  });

  it("kickoffUtcFromGameDate returns null for date-only rows (fail-loud)", () => {
    expect(kickoffUtcFromGameDate({ date: "2026-09-07" })).toBeNull();
  });

  it("resolveTeamId matches abbreviation and canonical name", () => {
    expect(resolveTeamId({ code: "KC", name: "Kansas City Chiefs" }, lookup)).toEqual({ ok: true, teamId: "team-kc" });
    expect(resolveTeamId({ name: "Buffalo Bills" }, lookup)).toEqual({ ok: true, teamId: "team-buf" });
    expect(resolveTeamId({ code: "XXX" }, lookup).ok).toBe(false);
  });

  it("mapApiSportsRowsToScheduleUpserts builds natural keys for regular season only", () => {
    const rows = apiSportsGamesEnvelopeSchema.parse({
      response: [
        {
          game: { id: 1, stage: "Regular Season", week: "1", date: { timestamp: 1700000000 } },
          teams: {
            home: { code: "KC", name: "Kansas City Chiefs" },
            away: { code: "BUF", name: "Buffalo Bills" },
          },
        },
        {
          game: { id: 2, stage: "Pre Season", week: "2", date: { timestamp: 1700000001 } },
          teams: {
            home: { code: "KC", name: "Kansas City Chiefs" },
            away: { code: "BUF", name: "Buffalo Bills" },
          },
        },
      ],
    }).response;

    const out = mapApiSportsRowsToScheduleUpserts(rows, 2026, lookup);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      nflSeasonYear: 2026,
      weekNumber: 1,
      homeTeamId: "team-kc",
      awayTeamId: "team-buf",
    });
  });

  it("mapApiSportsRowsToScheduleUpserts errors on duplicate natural key", () => {
    const rows = apiSportsGamesEnvelopeSchema.parse({
      response: [
        {
          game: { id: 1, stage: "Regular Season", week: "1", date: { timestamp: 1700000000 } },
          teams: {
            home: { code: "KC", name: "Kansas City Chiefs" },
            away: { code: "BUF", name: "Buffalo Bills" },
          },
        },
        {
          game: { id: 2, stage: "Regular Season", week: "1", date: { timestamp: 1700000001 } },
          teams: {
            home: { code: "KC", name: "Kansas City Chiefs" },
            away: { code: "BUF", name: "Buffalo Bills" },
          },
        },
      ],
    }).response;

    const out = mapApiSportsRowsToScheduleUpserts(rows, 2026, lookup);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.errors[0]?.message).toBe("duplicate_game_key");
  });

  it("mapApiSportsRowsToScheduleUpserts fails on unknown team with errors", () => {
    const rows = apiSportsGamesEnvelopeSchema.parse({
      response: [
        {
          game: { id: 9, stage: "Regular Season", week: "1", date: { timestamp: 1700000000 } },
          teams: {
            home: { code: "KC", name: "Kansas City Chiefs" },
            away: { code: "ZZZ", name: "Nowhere" },
          },
        },
      ],
    }).response;

    const out = mapApiSportsRowsToScheduleUpserts(rows, 2026, lookup);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.errors.length).toBeGreaterThan(0);
  });
});
