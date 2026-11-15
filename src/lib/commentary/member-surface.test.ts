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

  it("does not add a chat route", () => {
    const chatRoutes = filesUnder(join(process.cwd(), "src/app")).filter((path) =>
      path.includes(`${join("chat")}`),
    );
    expect(chatRoutes).toEqual([]);
  });
});
