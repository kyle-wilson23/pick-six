/**
 * Route group `(app)`: authenticated shell for in-app pages (Epic 2+ league UI will live here).
 * Public marketing, login, signup, and `/api/**` stay outside this group.
 *
 * `x-pathname` is set in `src/proxy.ts` only for routes matched there — extend the proxy
 * `matcher` when adding new app URLs (e.g. `/leagues`, `/profile`) so `callbackUrl` after login targets the requested path.
 */

import { headers } from "next/headers";

import { AppNavLeagueRootProvider } from "@/components/layout/AppNavLeagueContext";
import { LeagueNavShell } from "@/components/league/LeagueNavShell";
import { auth } from "@/lib/auth";
import { buildLoginRedirectWithCallback } from "@/lib/callback-url";
import { userDisplayName } from "@/lib/user-display-name";
import { redirect } from "next/navigation";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    const pathname = (await headers()).get("x-pathname") ?? "/home";
    redirect(buildLoginRedirectWithCallback(pathname));
  }

  const displayName = session.user.email
    ? userDisplayName({ name: session.user.name, email: session.user.email })
    : (session.user.name?.trim() || "User");

  return (
    <AppNavLeagueRootProvider>
      <LeagueNavShell
        userDisplayName={displayName}
        userImageUrl={session.user.image ?? null}
      >
        {children}
      </LeagueNavShell>
    </AppNavLeagueRootProvider>
  );
}
