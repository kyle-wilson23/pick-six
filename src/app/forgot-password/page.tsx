import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { Suspense } from "react";

import { ForgotPasswordClient } from "./forgot-password-client";

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <Stack minHeight="100vh" alignItems="center" justifyContent="center">
          <CircularProgress aria-label="Loading" />
        </Stack>
      }
    >
      <ForgotPasswordClient />
    </Suspense>
  );
}
