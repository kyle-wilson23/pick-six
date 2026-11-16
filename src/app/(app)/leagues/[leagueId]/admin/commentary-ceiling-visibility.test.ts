import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("league admin ceiling field", () => {
  it("renders the ceiling field only when the viewer is the superuser", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/leagues/[leagueId]/admin/page.tsx"), "utf8");
    const weeklyStart = page.indexOf("Weekly Email");
    const reminderStart = page.indexOf("Reminder Emails");
    expect(weeklyStart).toBeGreaterThanOrEqual(0);
    expect(reminderStart).toBeGreaterThan(weeklyStart);
    const weekly = page.slice(weeklyStart, reminderStart);
    const withoutSuperuserBranch = weekly.replace(
      /\{access\.isSuperuser \? \([\s\S]*?\) : null\}/,
      "",
    );

    expect(weekly).toMatch(/\{access\.isSuperuser \? \([\s\S]*<CommentaryCeilingField/);
    expect(weekly).toMatch(
      /\{access\.isSuperuser \? \([\s\S]*ceilingUsd=\{league\.commentaryWeeklyCeilingUsd\.toString\(\)\}/,
    );
    expect(withoutSuperuserBranch).not.toContain("CommentaryCeilingField");
  });
});
