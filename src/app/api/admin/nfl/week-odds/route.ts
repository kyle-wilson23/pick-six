import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOddsLinesForWeek } from "@/lib/nfl/effective-odds";
import { assertAuthorizedForNflOddsOps } from "@/lib/nfl/authorize-odds-admin";
import { zNflRegularSeasonWeek } from "@/lib/nfl/nfl-regular-season";
import { z } from "zod";

const querySchema = z.object({
  nflSeasonYear: z.coerce.number().int().min(2000).max(2100),
  weekNumber: zNflRegularSeasonWeek,
});

/**
 * GET `/api/admin/nfl/week-odds` — list games for a week with **effective** (latest) snapshot lines.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const authz = await assertAuthorizedForNflOddsOps(request, session?.user?.id);
  if (authz) {
    return authz;
  }

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    nflSeasonYear: sp.get("nflSeasonYear"),
    weekNumber: sp.get("weekNumber"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid query" } },
      { status: 400 },
    );
  }

  const { nflSeasonYear, weekNumber } = parsed.data;

  const games = await prisma.nflGame.findMany({
    where: { nflSeasonYear, weekNumber },
    orderBy: { kickoffAt: "asc" },
    include: {
      homeTeam: { select: { abbreviation: true, name: true } },
      awayTeam: { select: { abbreviation: true, name: true } },
    },
  });

  const lines = await getEffectiveOddsLinesForWeek(prisma, nflSeasonYear, weekNumber);

  return NextResponse.json({
    nflSeasonYear,
    weekNumber,
    games: games.map((g) => {
      const line = lines.get(g.id);
      return {
        id: g.id,
        kickoffAt: g.kickoffAt.toISOString(),
        homeAbbreviation: g.homeTeam.abbreviation,
        awayAbbreviation: g.awayTeam.abbreviation,
        homeMoneylineAmerican: line?.homeMoneylineAmerican ?? null,
        awayMoneylineAmerican: line?.awayMoneylineAmerican ?? null,
        homeSpreadPoints: line?.homeSpreadPoints?.toString() ?? null,
      };
    }),
  });
}
