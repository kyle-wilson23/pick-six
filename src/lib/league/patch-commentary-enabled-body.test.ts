import { describe, expect, it } from "vitest";

import { patchCommentaryEnabledBodySchema } from "./patch-commentary-enabled-body";

describe("patchCommentaryEnabledBodySchema", () => {
  it("accepts boolean true and false", () => {
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: true }).success).toBe(
      true,
    );
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: false }).success).toBe(
      true,
    );
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: true }).data).toEqual({
      commentaryEnabled: true,
    });
  });

  it("rejects non-booleans, missing fields, and extra keys", () => {
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: "true" }).success).toBe(
      false,
    );
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: 1 }).success).toBe(
      false,
    );
    expect(patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: null }).success).toBe(
      false,
    );
    expect(patchCommentaryEnabledBodySchema.safeParse({}).success).toBe(false);
    expect(
      patchCommentaryEnabledBodySchema.safeParse({ commentaryEnabled: true, extra: 1 }).success,
    ).toBe(false);
  });
});
