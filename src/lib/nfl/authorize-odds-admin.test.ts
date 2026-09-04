import { describe, expect, it } from "vitest";

import { resolveNflOddsOpsAuthorization } from "./authorize-odds-admin";

describe("resolveNflOddsOpsAuthorization", () => {
  it("allows a valid bearer secret without a session", () => {
    expect(
      resolveNflOddsOpsAuthorization({
        bearerAuthorized: true,
        userId: undefined,
        isSuperuser: false,
        hasAnyLeagueAdminMembership: false,
      }),
    ).toBe("allow");
  });

  it("requires sign-in when there is no bearer and no user", () => {
    expect(
      resolveNflOddsOpsAuthorization({
        bearerAuthorized: false,
        userId: undefined,
        isSuperuser: false,
        hasAnyLeagueAdminMembership: false,
      }),
    ).toBe("unauthenticated");
  });

  it("allows a superuser with no league admin memberships", () => {
    expect(
      resolveNflOddsOpsAuthorization({
        bearerAuthorized: false,
        userId: "u-1",
        isSuperuser: true,
        hasAnyLeagueAdminMembership: false,
      }),
    ).toBe("allow");
  });

  it("allows any-league ADMIN membership", () => {
    expect(
      resolveNflOddsOpsAuthorization({
        bearerAuthorized: false,
        userId: "u-1",
        isSuperuser: false,
        hasAnyLeagueAdminMembership: true,
      }),
    ).toBe("allow");
  });

  it("forbids a signed-in non-admin", () => {
    expect(
      resolveNflOddsOpsAuthorization({
        bearerAuthorized: false,
        userId: "u-1",
        isSuperuser: false,
        hasAnyLeagueAdminMembership: false,
      }),
    ).toBe("forbidden");
  });
});
