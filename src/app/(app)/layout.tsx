/**
 * Route group `(app)`: authenticated shell for in-app pages (Epic 2+ league UI will live here).
 * Public marketing, login, signup, and `/api/**` stay outside this group.
 *
 * `x-pathname` is set in `src/proxy.ts` only for routes matched there — extend the proxy
 * `matcher` when adding new app URLs so `callbackUrl` after login targets the requested path.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { buildLoginRedirectWithCallback } from "@/lib/callback-url";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(buildLoginRedirectWithCallback(pathname));
  }

  return <>{children}</>;
}
