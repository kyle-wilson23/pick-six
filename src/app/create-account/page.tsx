import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/lib/auth";

import { CreateAccountClient } from "./create-account-client";

export default async function CreateAccountPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/home");
  }

  return (
    <Suspense
      fallback={
        <Stack minHeight="100vh" alignItems="center" justifyContent="center">
          <CircularProgress aria-label="Loading" />
        </Stack>
      }
    >
      <CreateAccountClient />
    </Suspense>
  );
}
