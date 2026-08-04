import { describe, expect, it } from "vitest";

import { updateProfileBodySchema } from "@/lib/profile";

describe("updateProfileBodySchema", () => {
  it("accepts valid email and names", () => {
    const parsed = updateProfileBodySchema.safeParse({
      email: "  Ada@Example.com  ",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("Ada@Example.com");
      expect(parsed.data.firstName).toBe("Ada");
      expect(parsed.data.lastName).toBe("Lovelace");
    }
  });

  it("rejects blank names", () => {
    const parsed = updateProfileBodySchema.safeParse({
      email: "ada@example.com",
      firstName: "",
      lastName: "Lovelace",
    });
    expect(parsed.success).toBe(false);
  });
});
