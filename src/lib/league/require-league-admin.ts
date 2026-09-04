import { NextResponse } from "next/server";

import { loadLeagueAccess, type LeagueAccess } from "@/lib/league/get-league-access";

export function unauthenticatedJson(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
    { status: 401 },
  );
}

export function forbiddenAdminJson(
  message = "Admin access required for this league",
): NextResponse {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 },
  );
}

/** League-scoped admin APIs: session user must be league ADMIN or superuser. */
export async function requireLeagueAdminAccess(
  userId: string,
  leagueId: string,
): Promise<LeagueAccess | null> {
  const access = await loadLeagueAccess(userId, leagueId);
  if (!access?.isAdmin) {
    return null;
  }
  return access;
}
