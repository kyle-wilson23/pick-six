import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("League.commentaryWeeklyCeilingUsd default", () => {
  it("migration defaults existing rows to 1 and not null", () => {
    const root = join(process.cwd(), "prisma/migrations");
    const sql = readdirSync(root)
      .map((dir) => {
        try {
          return readFileSync(join(root, dir, "migration.sql"), "utf8");
        } catch {
          return "";
        }
      })
      .find((text) => text.includes("commentary_weekly_ceiling_usd"));

    expect(sql).toMatch(
      /"commentary_weekly_ceiling_usd" DECIMAL\(12,6\) NOT NULL DEFAULT 1/,
    );
  });

  it("schema default is 1 and create does not set the field", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(
      /commentaryWeeklyCeilingUsd\s+Decimal\s+@default\(1\)\s+@map\("commentary_weekly_ceiling_usd"\)\s+@db\.Decimal\(12,\s*6\)/,
    );

    const route = readFileSync(join(process.cwd(), "src/app/api/leagues/route.ts"), "utf8");
    const createStart = route.indexOf("tx.league.create");
    const createEnd = route.indexOf("tx.season.create");
    expect(createStart).toBeGreaterThanOrEqual(0);
    expect(createEnd).toBeGreaterThan(createStart);
    const createCall = route.slice(createStart, createEnd);
    expect(createCall).not.toContain("commentaryWeeklyCeilingUsd");
    expect(createCall).not.toContain("commentary_weekly_ceiling_usd");
  });
});
