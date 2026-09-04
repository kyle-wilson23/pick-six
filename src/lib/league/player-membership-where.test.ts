import { describe, expect, it } from "vitest";

import { leaguePlayerMembershipWhere } from "./player-membership-where";

describe("leaguePlayerMembershipWhere", () => {
  it("filters only by league when SUPERUSER_EMAIL is unset", () => {
    expect(leaguePlayerMembershipWhere("lg-1", {})).toEqual({ leagueId: "lg-1" });
  });

  it("excludes the configured superuser email", () => {
    expect(
      leaguePlayerMembershipWhere("lg-1", { SUPERUSER_EMAIL: " Kyle@X.com " }),
    ).toEqual({
      leagueId: "lg-1",
      user: { email: { not: "kyle@x.com" } },
    });
  });
});
