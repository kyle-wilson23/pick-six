import type { PrismaClient } from "@prisma/client";

import { prisma as prismaSingleton } from "@/lib/db";

export type AuditLogEntryView = {
  id: string;
  adminName: string;
  targetName: string;
  nflWeekNumber: number;
  beforeTeamName: string | null;
  afterTeamName: string;
  beforeAntiJailed: boolean | null;
  afterAntiJailed: boolean;
  createdAt: string;
};

export async function getAuditLog(
  args: { leagueId: string },
  db: PrismaClient = prismaSingleton,
): Promise<AuditLogEntryView[]> {
  const { leagueId } = args;

  const entries = await db.auditLogEntry.findMany({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
    include: {
      adminMembership: { include: { user: { select: { name: true, email: true } } } },
      targetMembership: { include: { user: { select: { name: true, email: true } } } },
      beforeTeam: { select: { name: true } },
      afterTeam: { select: { name: true } },
    },
  });

  return entries.map((e) => ({
    id: e.id,
    adminName: e.adminMembership.user.name ?? e.adminMembership.user.email,
    targetName: e.targetMembership.user.name ?? e.targetMembership.user.email,
    nflWeekNumber: e.nflWeekNumber,
    beforeTeamName: e.beforeTeam?.name ?? null,
    afterTeamName: e.afterTeam.name,
    beforeAntiJailed: e.beforeAntiJailed,
    afterAntiJailed: e.afterAntiJailed,
    createdAt: e.createdAt.toISOString(),
  }));
}
