import { notFound } from "next/navigation";

import { SyncAppNavLeague } from "@/components/layout/AppNavLeagueContext";
import { auth } from "@/lib/auth";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { recordLeagueVisit } from "@/lib/league/record-league-visit";

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
  if (!access) {
    notFound();
  }

  void recordLeagueVisit(session.user.id, leagueId).catch(() => {
    /* best-effort — do not block render */
  });

  return (
    <SyncAppNavLeague
      value={{
        leagueId,
        leagueName: access.league.name,
        isTestLeague: access.league.isTestLeague,
        isAdmin: access.isAdmin,
      }}
    >
      {children}
    </SyncAppNavLeague>
  );
}
