import { LeagueMembershipRole } from "@prisma/client";

/**
 * “In this league as a player” — **ADMIN** and **MEMBER** (Story 2.6 / FR13).
 * Pick APIs and participant routes must use this (or {@link assertLeagueParticipant}), not
 * `role === MEMBER`, so league creators with a single **ADMIN** row stay eligible.
 */
export function isLeagueParticipantRole(role: LeagueMembershipRole): boolean {
  return role === LeagueMembershipRole.ADMIN || role === LeagueMembershipRole.MEMBER;
}

/**
 * Throws if membership is missing or the role is not a participant role.
 * App Router pages that should return 404 prefer:
 * `if (!membership) notFound(); if (!isLeagueParticipantRole(membership.role)) notFound();`
 */
export function assertLeagueParticipant(
  membership: { role: LeagueMembershipRole } | null,
): asserts membership is { role: LeagueMembershipRole } {
  if (!membership) {
    throw new Error("League membership required");
  }
  if (!isLeagueParticipantRole(membership.role)) {
    throw new Error("Not a league participant");
  }
}
