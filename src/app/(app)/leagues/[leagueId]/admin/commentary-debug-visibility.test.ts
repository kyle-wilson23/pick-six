import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("league admin held note", () => {
  it("shows stored sentences to every admin and the switch only to the superuser", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(app)/leagues/[leagueId]/admin/page.tsx"),
      "utf8",
    );
    const weeklyStart = page.indexOf("Weekly Email");
    const reminderStart = page.indexOf("Reminder Emails");
    expect(weeklyStart).toBeGreaterThanOrEqual(0);
    expect(reminderStart).toBeGreaterThan(weeklyStart);
    const weekly = page.slice(weeklyStart, reminderStart);
    const withoutSuperuserBranch = weekly.replace(
      /\{access\.isSuperuser \? \([\s\S]*?\) : null\}/,
      "",
    );

    expect(page).not.toMatch(/runCommentary|generateText|from ["']ai["']/);
    expect(page).not.toContain("Quiet week. Nothing new for the record book.");
    expect(page).toContain("heldCommentarySentences({");
    expect(page).toContain("commentaryDebug: league.commentaryDebug");
    expect(page).toContain("prisma.commentaryRun.findUnique");
    expect(page).toContain("nflSeasonYear: season.nflSeasonYear");
    expect(page).toMatch(/league\.commentaryDebug && season != null && weekNumber != null/);
    expect(weekly).toMatch(/\{access\.isSuperuser \? \([\s\S]*<CommentaryDebugSwitch/);
    expect(weekly).toMatch(
      /key=\{`\$\{leagueId\}-commentary-debug`\}[\s\S]*commentaryDebug=\{league\.commentaryDebug\}/,
    );
    expect(weekly).toContain("key={`${leagueId}-commentary-ceiling`}");
    expect(withoutSuperuserBranch).not.toContain("CommentaryDebugSwitch");
    expect(withoutSuperuserBranch).toContain("HeldCommentaryNote");
    expect(withoutSuperuserBranch).toContain("sentences={heldSentences}");
  });
});
