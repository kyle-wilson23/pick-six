import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

describe("member surfaces", () => {
  it("league member pages do not call the model or show the note", () => {
    const root = join(process.cwd(), "src/app/(app)/leagues/[leagueId]");
    const memberFiles = filesUnder(root).filter((path) => !path.includes(`${join("admin")}`));
    expect(memberFiles.length).toBeGreaterThan(0);
    for (const path of memberFiles) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/runCommentary|generateText|from ["']ai["']/);
      expect(source).not.toContain("Quiet week. Nothing new for the record book.");
    }
  });

  it("member routes and scoring readers do not reference the book", () => {
    const pages = [
      ["standings/page.tsx", "getLeagueStandings"],
      ["results/page.tsx", "getLeaguePeerPickHistory"],
      ["history/page.tsx", "getPersonalPickHistory"],
    ] as const;
    for (const [page, reader] of pages) {
      const source = readFileSync(
        join(process.cwd(), "src/app/(app)/leagues/[leagueId]", page),
        "utf8",
      );
      expect(source).toContain("getCurrentNflSeasonYear");
      expect(source).toContain(reader);
      expect(source).not.toMatch(/bookRow|book_rows|BookRow/);
      expect(source).not.toMatch(/runCommentary|loadCommentaryWeekView/);
    }
    const readers = [
      "src/lib/scoring/get-league-standings.ts",
      "src/lib/scoring/get-league-peer-pick-history.ts",
      "src/lib/scoring/get-personal-pick-history.ts",
    ];
    for (const relative of readers) {
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      expect(source).toContain("nflSeasonYear");
      expect(source).toMatch(/pick/i);
      expect(source).not.toMatch(/bookRow|book_rows|BookRow/);
      expect(source).not.toMatch(/runCommentary|loadCommentaryWeekView|commentary/);
    }
  });

  it("does not add a chat route", () => {
    const chatRoutes = filesUnder(join(process.cwd(), "src/app")).filter((path) =>
      path.includes(`${join("chat")}`),
    );
    expect(chatRoutes).toEqual([]);
  });
});
