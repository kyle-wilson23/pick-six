import { describe, expect, it } from "vitest";

import {
  buildIssueMarkdown,
  buildIssueTitle,
  formFactorFromWidth,
} from "./build-issue-markdown";

const base = {
  description: "Picks page froze after submit",
  user: { id: "user-1", name: "Kyle Wilson", email: "kyle@example.com" },
  league: { id: "lg-1", name: "Alpha" },
  visitTrail: ["/home", "/leagues/lg-1/picks"],
  device: {
    userAgent: "Mozilla/5.0",
    viewportWidth: 390,
    viewportHeight: 844,
    formFactor: "mobile" as const,
  },
};

describe("buildIssueTitle", () => {
  it("prefixes and truncates", () => {
    expect(buildIssueTitle("  hello   world  ")).toBe("[User report] hello world");
    expect(buildIssueTitle("x".repeat(80)).length).toBe("[User report] ".length + 70);
  });
});

describe("formFactorFromWidth", () => {
  it("treats width under 900 as mobile", () => {
    expect(formFactorFromWidth(899)).toBe("mobile");
    expect(formFactorFromWidth(900)).toBe("desktop");
  });
});

describe("buildIssueMarkdown", () => {
  it("includes labeled sections", () => {
    const body = buildIssueMarkdown(base);
    expect(body).toContain("## Description");
    expect(body).toContain("Picks page froze after submit");
    expect(body).toContain("kyle@example.com");
    expect(body).toContain("Alpha (`lg-1`)");
    expect(body).toContain("`/leagues/lg-1/picks`");
    expect(body).toContain("390x844");
    expect(body).toContain("formFactor: mobile");
    expect(body).not.toContain("![screenshot]");
  });

  it("embeds screenshot markdown and omits league when null", () => {
    const body = buildIssueMarkdown({
      ...base,
      screenshotUrl: "https://example.blob.vercel-storage.com/shot.png",
      league: null,
    });
    expect(body).toContain(
      "![screenshot](https://example.blob.vercel-storage.com/shot.png)",
    );
    expect(body).toContain("(none)");
  });
});
