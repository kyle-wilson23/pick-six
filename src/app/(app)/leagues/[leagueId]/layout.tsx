import { LeagueMembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { LeagueNavShell } from "@/components/league/LeagueNavShell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLeagueParticipantRole } from "@/lib/league/participant-membership";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueLayout({ children, params }: LayoutProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership || !isLeagueParticipantRole(membership.role)) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });

  if (!league) {
    notFound();
  }

  const userDisplayName =
    session.user.name ?? session.user.email ?? "User";

  return (
    <LeagueNavShell
      leagueId={leagueId}
      leagueName={league.name}
      isAdmin={membership.role === LeagueMembershipRole.ADMIN}
      userDisplayName={userDisplayName}
    >
      {children}
    </LeagueNavShell>
  );
}
