import { LeagueMembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assertLeagueParticipant, isLeagueParticipantRole } from "./participant-membership";

describe("isLeagueParticipantRole", () => {
  it("returns true for ADMIN (creator / single-row admin identity)", () => {
    expect(isLeagueParticipantRole(LeagueMembershipRole.ADMIN)).toBe(true);
  });

  it("returns true for MEMBER", () => {
    expect(isLeagueParticipantRole(LeagueMembershipRole.MEMBER)).toBe(true);
  });

  /**
   * Guardrail: a mistaken `role === LeagueMembershipRole.MEMBER` gate excludes **ADMIN** and
   * breaks FR13. Future pick APIs should use {@link isLeagueParticipantRole} instead.
   */
  it("flags that MEMBER-only equality would exclude admins", () => {
    const adminRole = LeagueMembershipRole.ADMIN;
    expect(isLeagueParticipantRole(adminRole)).toBe(true);
    expect(adminRole === LeagueMembershipRole.MEMBER).toBe(false);
  });
});

describe("assertLeagueParticipant", () => {
  it("does not throw for ADMIN or MEMBER", () => {
    expect(() =>
      assertLeagueParticipant({ role: LeagueMembershipRole.ADMIN }),
    ).not.toThrow();
    expect(() =>
      assertLeagueParticipant({ role: LeagueMembershipRole.MEMBER }),
    ).not.toThrow();
  });

  it("throws when membership is null", () => {
    expect(() => assertLeagueParticipant(null)).toThrow("League membership required");
  });
});
