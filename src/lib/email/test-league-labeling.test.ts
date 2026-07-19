import { describe, expect, it } from "vitest";

import { formatEmailSubject } from "./test-league-labeling";

describe("formatEmailSubject", () => {
  it("returns subject unchanged when not a test league", () => {
    expect(formatEmailSubject("You're invited to join X on Pick Six", false)).toBe(
      "You're invited to join X on Pick Six",
    );
    expect(formatEmailSubject("[X] Week 1 — Tuesday Update", false)).toBe(
      "[X] Week 1 — Tuesday Update",
    );
  });

  it("prefixes invite subjects with [TEST] and a space", () => {
    expect(formatEmailSubject("You're invited to join X on Pick Six", true)).toBe(
      "[TEST] You're invited to join X on Pick Six",
    );
  });

  it("prefixes bracket subjects with [TEST] without an extra space", () => {
    expect(formatEmailSubject("[Office] Week 3 — Tuesday Update", true)).toBe(
      "[TEST][Office] Week 3 — Tuesday Update",
    );
  });
});
