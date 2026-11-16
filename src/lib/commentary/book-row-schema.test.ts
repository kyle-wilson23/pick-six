import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function modelBlock(schema: string, name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = schema.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return schema.slice(start, end + 2);
}

describe("BookRow", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(process.cwd(), "prisma/migrations/20261116120000_add_book_rows/migration.sql"),
    "utf8",
  );
  const book = modelBlock(schema, "BookRow");

  it("rejects a second cell for the same person, year, and week", () => {
    expect(book).toMatch(/@@unique\(\[leaguePersonId, nflSeasonYear, weekNumber\]\)/);
    expect(book).toMatch(/@@map\("book_rows"\)/);
    expect(book).not.toMatch(/seasonId|pointsEarned/);
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "book_rows_league_person_id_nfl_season_year_week_number_key" ON "book_rows"\("league_person_id", "nfl_season_year", "week_number"\)/,
    );
  });

  it("requires outcome and points, and leaves team optional", () => {
    expect(book).toMatch(/outcome\s+PickOutcome\b/);
    expect(book).not.toMatch(/outcome\s+PickOutcome\?/);
    expect(book).toMatch(/points\s+Int\b/);
    expect(book).not.toMatch(/points\s+Int\?/);
    expect(book).toMatch(/teamId\s+String\?\s+@map\("team_id"\)/);
    expect(book).toMatch(/id\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(book).toMatch(
      /leaguePerson\s+LeaguePerson\s+@relation\([^)]*onDelete:\s*Cascade/,
    );
    expect(migration).toMatch(/"outcome" "pick_outcome" NOT NULL/);
    expect(migration).toMatch(/"points" INTEGER NOT NULL/);
    const teamColumn = migration
      .split("\n")
      .find((line) => line.includes('"team_id"'));
    expect(teamColumn).toBeTruthy();
    expect(teamColumn).not.toContain("NOT NULL");
  });

  it("keeps the league person membership required", () => {
    const person = modelBlock(schema, "LeaguePerson");
    expect(person).toMatch(/leagueMembershipId\s+String\s+@unique\s+@map\("league_membership_id"\)/);
    expect(person).not.toMatch(/leagueMembershipId\s+String\?/);
  });
});
