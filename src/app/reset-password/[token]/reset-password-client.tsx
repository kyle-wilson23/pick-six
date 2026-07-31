"use client";

import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";

import { SkipLink } from "@/components/a11y/SkipLink";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

import { ResetPasswordForm } from "./reset-password-form";

type ResetPasswordClientProps = {
  token: string;
  isValid: boolean;
};

export function ResetPasswordClient({ token, isValid }: ResetPasswordClientProps) {
  return (
    <>
      <SkipLink />
      <Stack
        component="main"
        id="main-content"
        tabIndex={-1}
        spacing={3}
        sx={{
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 4,
          ...skipTargetMainSx,
        }}
      >
        <Typography variant="h4" component="h1">
          Reset password
        </Typography>

        {!isValid ? (
          <>
            <Alert severity="warning" sx={{ maxWidth: 400 }}>
              This reset link is invalid or has expired. Request a new password reset link if you
              still need access.
            </Alert>
            <Link component={NextLink} href="/forgot-password" variant="body2">
              Request password reset
            </Link>
          </>
        ) : (
          <ResetPasswordForm token={token} />
        )}

        <Link component={NextLink} href="/login" variant="body2">
          Back to login
        </Link>
      </Stack>
    </>
  );
}
