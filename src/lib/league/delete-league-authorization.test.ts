import { LeagueMembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { authorizeLeagueDelete } from "./delete-league-authorization";

describe("authorizeLeagueDelete", () => {
  it("returns league_not_found when the league row does not exist", () => {
    expect(
      authorizeLeagueDelete({
        leagueExists: false,
        membership: null,
      }),
    ).toEqual({ outcome: "league_not_found" });
  });

  it("returns forbidden when the user is not an admin (member)", () => {
    expect(
      authorizeLeagueDelete({
        leagueExists: true,
        membership: { role: LeagueMembershipRole.MEMBER },
      }),
    ).toEqual({ outcome: "forbidden" });
  });

  it("returns forbidden when there is no membership for this league", () => {
    expect(
      authorizeLeagueDelete({
        leagueExists: true,
        membership: null,
      }),
    ).toEqual({ outcome: "forbidden" });
  });

  it("returns ok when the league exists and the user is an admin", () => {
    expect(
      authorizeLeagueDelete({
        leagueExists: true,
        membership: { role: LeagueMembershipRole.ADMIN },
      }),
    ).toEqual({ outcome: "ok" });
  });
});
