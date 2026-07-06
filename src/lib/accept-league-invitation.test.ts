import { describe, expect, it } from "vitest";

import { InviteAcceptError } from "./accept-league-invitation";

describe("InviteAcceptError", () => {
  it("exposes error codes for route handlers", () => {
    const bad = new InviteAcceptError("INVITE_BAD");
    expect(bad.code).toBe("INVITE_BAD");
    const mismatch = new InviteAcceptError("EMAIL_MISMATCH");
    expect(mismatch.code).toBe("EMAIL_MISMATCH");
  });
});
