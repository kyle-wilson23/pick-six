import { LeagueMembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { LeagueNavShell } from "@/components/league/LeagueNavShell";
import { auth } from "@/lib/auth";
import { getLeagueAccess } from "@/lib/league/get-league-access";
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

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || !isLeagueParticipantRole(access.membership.role)) {
    notFound();
  }

  const userDisplayName =
    session.user.name ?? session.user.email ?? "User";

  return (
    <LeagueNavShell
      leagueId={leagueId}
      leagueName={access.league.name}
      isAdmin={access.membership.role === LeagueMembershipRole.ADMIN}
      userDisplayName={userDisplayName}
    >
      {children}
    </LeagueNavShell>
  );
}
