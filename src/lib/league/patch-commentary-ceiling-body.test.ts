import { describe, expect, it } from "vitest";

import { patchCommentaryCeilingBodySchema } from "./patch-commentary-ceiling-body";

describe("patchCommentaryCeilingBodySchema", () => {
  it("accepts 0 and 2.5 and stores the decimal string", () => {
    expect(patchCommentaryCeilingBodySchema.parse({ commentaryWeeklyCeilingUsd: "0" })).toEqual({
      commentaryWeeklyCeilingUsd: "0",
    });
    expect(patchCommentaryCeilingBodySchema.parse({ commentaryWeeklyCeilingUsd: "2.5" })).toEqual({
      commentaryWeeklyCeilingUsd: "2.5",
    });
    expect(
      patchCommentaryCeilingBodySchema.parse({ commentaryWeeklyCeilingUsd: "  2.50  " }),
    ).toEqual({
      commentaryWeeklyCeilingUsd: "2.5",
    });
  });

  it("rejects blank, negative, a dollar sign, and a decimal that does not fit Decimal(12, 6)", () => {
    expect(patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "" }).success).toBe(
      false,
    );
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "   " }).success,
    ).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "-1" }).success,
    ).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "$1" }).success,
    ).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "1000000" }).success,
    ).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: "0.0000001" })
        .success,
    ).toBe(false);
  });

  it("rejects a missing field, a number, and extra keys", () => {
    expect(patchCommentaryCeilingBodySchema.safeParse({}).success).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({ commentaryWeeklyCeilingUsd: 2.5 }).success,
    ).toBe(false);
    expect(
      patchCommentaryCeilingBodySchema.safeParse({
        commentaryWeeklyCeilingUsd: "2.5",
        commentaryEnabled: true,
      }).success,
    ).toBe(false);
  });
});
