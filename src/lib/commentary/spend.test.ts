import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { addCallSpend } from "./spend";

const prices = {
  inputUsdPerMillion: new Prisma.Decimal("3"),
  outputUsdPerMillion: new Prisma.Decimal("15"),
};

describe("addCallSpend", () => {
  it("a non-call adds nothing", () => {
    const current = new Prisma.Decimal("0.25");
    expect(addCallSpend(current, null, prices)).toBe(current);
  });

  it("adds input and output tokens times the per-million prices", () => {
    const spend = addCallSpend(
      new Prisma.Decimal(0),
      { inputTokens: 1_000_000, outputTokens: 500_000 },
      prices,
    );
    expect(spend.equals("10.5")).toBe(true);
  });
});
