import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("League.commentaryEnabled default", () => {
  it("migration defaults existing rows to false and not null", () => {
    const root = join(process.cwd(), "prisma/migrations");
    const sql = readdirSync(root)
      .map((dir) => {
        try {
          return readFileSync(join(root, dir, "migration.sql"), "utf8");
        } catch {
          return "";
        }
      })
      .find((text) => text.includes("commentary_enabled"));

    expect(sql).toMatch(/"commentary_enabled" BOOLEAN NOT NULL DEFAULT false/);
  });

  it("schema default is false and create does not set the field", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(
      /commentaryEnabled\s+Boolean\s+@default\(false\)\s+@map\("commentary_enabled"\)/,
    );

    const route = readFileSync(join(process.cwd(), "src/app/api/leagues/route.ts"), "utf8");
    const createStart = route.indexOf("tx.league.create");
    const createEnd = route.indexOf("tx.season.create");
    expect(createStart).toBeGreaterThanOrEqual(0);
    expect(createEnd).toBeGreaterThan(createStart);
    const createCall = route.slice(createStart, createEnd);
    expect(createCall).not.toContain("commentaryEnabled");
    expect(createCall).not.toContain("commentary_enabled");
  });
});
