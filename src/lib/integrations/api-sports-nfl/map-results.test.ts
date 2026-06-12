import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildTeamLookup } from "./map-schedule";
import {
  mapApiSportsRowToResultUpdate,
  mapApiSportsRowsToResultUpdates,
  mapApiSportsStatusShortToNflGameStatus,
} from "./map-results";
import { apiSportsGamesEnvelopeSchema } from "./schemas";

const here = dirname(fileURLToPath(import.meta.url));

const lookup = buildTeamLookup([
  { id: "team-kc", abbreviation: "KC", name: "Kansas City Chiefs" },
  { id: "team-buf", abbreviation: "BUF", name: "Buffalo Bills" },
  { id: "team-chi", abbreviation: "CHI", name: "Chicago Bears" },
  { id: "team-cin", abbreviation: "CIN", name: "Cincinnati Bengals" },
  { id: "team-dal", abbreviation: "DAL", name: "Dallas Cowboys" },
  { id: "team-phi", abbreviation: "PHI", name: "Philadelphia Eagles" },
]);

function loadFixtureRows() {
  const raw = readFileSync(join(here, "fixtures", "nfl-results-sample.json"), "utf8");
  const json: unknown = JSON.parse(raw);
  const parsed = apiSportsGamesEnvelopeSchema.parse(json);
  return parsed.response;
}

describe("mapApiSportsStatusShortToNflGameStatus", () => {
  it("maps FT to FINAL", () => {
    expect(mapApiSportsStatusShortToNflGameStatus("FT")).toBe("FINAL");
  });

  it("maps Q3 to IN_PROGRESS with scores", () => {
    expect(mapApiSportsStatusShortToNflGameStatus("Q3")).toBe("IN_PROGRESS");
  });

  it("maps NS to SCHEDULED", () => {
    expect(mapApiSportsStatusShortToNflGameStatus("NS")).toBe("SCHEDULED");
  });

  it("maps unrecognized codes to IN_PROGRESS conservatively", () => {
    expect(mapApiSportsStatusShortToNflGameStatus("WEIRD")).toBe("IN_PROGRESS");
  });
});

describe("mapApiSportsRowsToResultUpdates", () => {
  it("maps fixture FT row to FINAL with scores", () => {
    const rows = loadFixtureRows();
    const ftRow = rows[0]!;
    const mapped = mapApiSportsRowToResultUpdate(ftRow, 2026, lookup);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update).toMatchObject({
      status: "FINAL",
      homeScore: 27,
      awayScore: 20,
      homeTeamId: "team-kc",
      awayTeamId: "team-buf",
    });
  });

  it("maps Q3 row to IN_PROGRESS with partial scores", () => {
    const rows = loadFixtureRows();
    const mapped = mapApiSportsRowToResultUpdate(rows[1]!, 2026, lookup);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update).toMatchObject({
      status: "IN_PROGRESS",
      homeScore: 14,
      awayScore: 10,
    });
  });

  it("maps NS row to SCHEDULED without score fields", () => {
    const rows = loadFixtureRows();
    const mapped = mapApiSportsRowToResultUpdate(rows[2]!, 2026, lookup);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update.status).toBe("SCHEDULED");
    expect(mapped.update.homeScore).toBeUndefined();
    expect(mapped.update.awayScore).toBeUndefined();
  });

  it("returns structured error for team match failure (no throw)", () => {
    const rows = loadFixtureRows();
    const { updates, errors } = mapApiSportsRowsToResultUpdates(rows, 2026, lookup);
    expect(updates.length).toBe(3);
    expect(errors.length).toBe(1);
    expect(errors[0]?.message).toContain("Unknown home team");
  });

  it("maps POST (Postponed) row to CANCELLED with null scores", () => {
    const mapped = mapApiSportsRowToResultUpdate(
      {
        game: { id: 999, stage: "Regular Season", week: "2", status: { short: "POST" } },
        teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
        scores: { home: { total: null }, away: { total: null } },
      } as never,
      2026,
      lookup,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update.status).toBe("CANCELLED");
    expect(mapped.update.homeScore).toBeNull();
    expect(mapped.update.awayScore).toBeNull();
  });

  it("maps CANC row to CANCELLED with null scores", () => {
    const mapped = mapApiSportsRowToResultUpdate(
      {
        game: { id: 1000, stage: "Regular Season", week: "3", status: { short: "CANC" } },
        teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
        scores: { home: { total: 7 }, away: { total: 3 } },
      } as never,
      2026,
      lookup,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update.status).toBe("CANCELLED");
    expect(mapped.update.homeScore).toBeNull();
    expect(mapped.update.awayScore).toBeNull();
  });

  it("does not include score fields in update when IN_PROGRESS provider scores are null", () => {
    const mapped = mapApiSportsRowToResultUpdate(
      {
        game: { id: 1001, stage: "Regular Season", week: "1", status: { short: "Q2" } },
        teams: { home: { code: "KC", name: "Kansas City Chiefs" }, away: { code: "BUF", name: "Buffalo Bills" } },
        scores: { home: { total: null }, away: { total: null } },
      } as never,
      2026,
      lookup,
    );
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.update.status).toBe("IN_PROGRESS");
    expect(mapped.update.homeScore).toBeUndefined();
    expect(mapped.update.awayScore).toBeUndefined();
  });
});
