import { LeagueMembershipRole, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { resolveLeagueAccess } from "./get-league-access";

const league = {
  id: "lg-1",
  name: "Test",
  isTestLeague: false,
  commentaryEnabled: false,
  commentaryWeeklyCeilingUsd: new Prisma.Decimal(1),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const adminMembership = {
  id: "mem-1",
  role: LeagueMembershipRole.ADMIN,
  userId: "u-1",
  leagueId: "lg-1",
};

const memberMembership = {
  ...adminMembership,
  role: LeagueMembershipRole.MEMBER,
};

const env = { SUPERUSER_EMAIL: "ops@example.com" };

describe("resolveLeagueAccess", () => {
  it("returns null without league", () => {
    expect(
      resolveLeagueAccess({
        userEmail: "ops@example.com",
        membership: null,
        league: null,
        env,
      }),
    ).toBeNull();
  });

  it("returns null for a non-member when env does not match", () => {
    expect(
      resolveLeagueAccess({
        userEmail: "player@example.com",
        membership: null,
        league,
        env,
      }),
    ).toBeNull();
  });

  it("allows a superuser with no membership to view as admin, not participant", () => {
    const access = resolveLeagueAccess({
      userEmail: "ops@example.com",
      membership: null,
      league,
      env,
    });
    expect(access).toMatchObject({
      membership: null,
      isSuperuser: true,
      isAdmin: true,
      isParticipant: false,
    });
  });

  it("keeps a normal admin as participant and admin", () => {
    const access = resolveLeagueAccess({
      userEmail: "admin@example.com",
      membership: adminMembership,
      league,
      env,
    });
    expect(access).toMatchObject({
      isSuperuser: false,
      isAdmin: true,
      isParticipant: true,
      league: { commentaryEnabled: false },
    });
  });

  it("returns the saved commentaryEnabled value on a later read", () => {
    const access = resolveLeagueAccess({
      userEmail: "admin@example.com",
      membership: adminMembership,
      league: { ...league, commentaryEnabled: true },
      env,
    });
    expect(access?.league.commentaryEnabled).toBe(true);
  });

  it("returns the saved commentary ceiling on a later read", () => {
    const access = resolveLeagueAccess({
      userEmail: "ops@example.com",
      membership: null,
      league: { ...league, commentaryWeeklyCeilingUsd: new Prisma.Decimal("2.5") },
      env,
    });
    expect(access?.league.commentaryWeeklyCeilingUsd.toString()).toBe("2.5");
  });

  it("keeps a normal member as participant, not admin", () => {
    const access = resolveLeagueAccess({
      userEmail: "member@example.com",
      membership: memberMembership,
      league,
      env,
    });
    expect(access).toMatchObject({
      isSuperuser: false,
      isAdmin: false,
      isParticipant: true,
    });
  });

  it("strips participant from a superuser who also has an ADMIN membership", () => {
    const access = resolveLeagueAccess({
      userEmail: "ops@example.com",
      membership: adminMembership,
      league,
      env,
    });
    expect(access).toMatchObject({
      isSuperuser: true,
      isAdmin: true,
      isParticipant: false,
    });
  });

  it("treats nobody as superuser when env is unset", () => {
    const access = resolveLeagueAccess({
      userEmail: "ops@example.com",
      membership: adminMembership,
      league,
      env: {},
    });
    expect(access).toMatchObject({
      isSuperuser: false,
      isAdmin: true,
      isParticipant: true,
    });
  });
});
