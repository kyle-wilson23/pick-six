import { LeagueMembershipRole } from "@prisma/client";

export type DeleteLeagueAuthorization =
  | { outcome: "ok" }
  | { outcome: "league_not_found" }
  | { outcome: "forbidden" };

/**
 * Maps league existence + membership to DELETE `/api/leagues/[leagueId]` outcomes (Story 2.8).
 * Unknown or already-deleted league id → `league_not_found` (404); non-admin → `forbidden` (403).
 */
export function authorizeLeagueDelete(args: {
  leagueExists: boolean;
  membership: { role: LeagueMembershipRole } | null;
  isSuperuser?: boolean;
}): DeleteLeagueAuthorization {
  if (!args.leagueExists) {
    return { outcome: "league_not_found" };
  }
  if (args.isSuperuser) {
    return { outcome: "ok" };
  }
  if (!args.membership || args.membership.role !== LeagueMembershipRole.ADMIN) {
    return { outcome: "forbidden" };
  }
  return { outcome: "ok" };
}
