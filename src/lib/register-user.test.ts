import { describe, expect, it } from "vitest";

import { isUniqueEmailViolation } from "@/lib/register-user";

describe("isUniqueEmailViolation", () => {
  it("returns true for any P2002 (constraint name or field target)", () => {
    expect(
      isUniqueEmailViolation({
        code: "P2002",
        meta: { target: ["email"] },
      }),
    ).toBe(true);
    expect(
      isUniqueEmailViolation({
        code: "P2002",
        meta: { target: ["User_email_key"] },
      }),
    ).toBe(true);
    expect(isUniqueEmailViolation({ code: "P2002" })).toBe(true);
  });

  it("returns false for non-P2002 errors", () => {
    expect(isUniqueEmailViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueEmailViolation(null)).toBe(false);
  });
});
