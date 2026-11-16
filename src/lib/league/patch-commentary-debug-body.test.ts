import { describe, expect, it } from "vitest";

import { patchCommentaryDebugBodySchema } from "./patch-commentary-debug-body";

describe("patchCommentaryDebugBodySchema", () => {
  it("accepts boolean true and false", () => {
    expect(patchCommentaryDebugBodySchema.parse({ commentaryDebug: true })).toEqual({
      commentaryDebug: true,
    });
    expect(patchCommentaryDebugBodySchema.parse({ commentaryDebug: false })).toEqual({
      commentaryDebug: false,
    });
  });

  it("rejects a string boolean and an extra key", () => {
    expect(patchCommentaryDebugBodySchema.safeParse({ commentaryDebug: "true" }).success).toBe(
      false,
    );
    expect(
      patchCommentaryDebugBodySchema.safeParse({ commentaryDebug: true, extra: 1 }).success,
    ).toBe(false);
  });
});
