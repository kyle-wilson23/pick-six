import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { Suspense } from "react";

import { LoginClient } from "./login-client";

export default function LoginPage() {
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
