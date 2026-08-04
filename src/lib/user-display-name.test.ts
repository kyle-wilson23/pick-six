import { describe, expect, it } from "vitest";

import { fullNameFromParts, userDisplayName } from "@/lib/user-display-name";

describe("fullNameFromParts", () => {
  it("joins trimmed first and last", () => {
    expect(fullNameFromParts("  Ada  ", " Lovelace ")).toBe("Ada Lovelace");
  });

  it("collapses internal whitespace", () => {
    expect(fullNameFromParts("Ada   Marie", "Lovelace")).toBe("Ada Marie Lovelace");
  });
});

describe("userDisplayName", () => {
  it("prefers non-empty name over email", () => {
    expect(userDisplayName({ name: "Ada Lovelace", email: "ada@example.com" })).toBe(
      "Ada Lovelace",
    );
  });

  it("falls back to email when name is null or blank", () => {
    expect(userDisplayName({ name: null, email: "ada@example.com" })).toBe("ada@example.com");
    expect(userDisplayName({ name: "   ", email: "ada@example.com" })).toBe("ada@example.com");
  });
});
