import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { getSafeCallbackPath } from "@/lib/callback-url";

import { LoginClient } from "./login-client";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    const sp = await searchParams;
    const rawCallback = sp.callbackUrl;
    const nextPath = getSafeCallbackPath(
      typeof rawCallback === "string" ? rawCallback : null,
      { defaultPath: "/dashboard" },
    );
    redirect(nextPath);
  }

  return (
    <Suspense
      fallback={
        <Stack minHeight="100vh" alignItems="center" justifyContent="center">
          <CircularProgress aria-label="Loading" />
        </Stack>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
