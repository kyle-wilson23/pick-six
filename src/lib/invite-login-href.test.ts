import { describe, expect, it } from "vitest";

import { buildInviteLoginHref } from "./invite-login-href";

describe("buildInviteLoginHref", () => {
  it("wraps the signup path in a login callback", () => {
    expect(buildInviteLoginHref("abc123")).toBe(
      "/login?callbackUrl=%2Fsignup%2Fabc123",
    );
  });
});
