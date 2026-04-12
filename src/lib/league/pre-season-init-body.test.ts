import { describe, expect, it } from "vitest";

import { preSeasonInitBodySchema } from "./pre-season-init-body";

describe("preSeasonInitBodySchema", () => {
  it("accepts empty object", () => {
    expect(preSeasonInitBodySchema.safeParse({}).success).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(preSeasonInitBodySchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});
