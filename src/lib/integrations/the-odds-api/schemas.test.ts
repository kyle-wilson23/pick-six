import { describe, expect, it } from "vitest";

import sample from "./fixtures/nfl-odds-sample.json";
import { theOddsApiOddsResponseSchema } from "./schemas";

describe("theOddsApiOddsResponseSchema", () => {
  it("parses recorded provider-shaped JSON", () => {
    const parsed = theOddsApiOddsResponseSchema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });
});
