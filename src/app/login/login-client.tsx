"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { SkipLink } from "@/components/a11y/SkipLink";
import { getSafeCallbackPath } from "@/lib/callback-url";
import { normalizeEmail } from "@/lib/normalize-email";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FieldErrors = {
  email?: string;
  password?: string;
};

export function LoginClient() {
  const searchParams = useSearchParams();
  const alertRef = useRef<HTMLDivElement>(null);
  const [resetBanner, setResetBanner] = useState(
    () => searchParams.get("reset") === "1",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  /** Auth failure: mark fields invalid without duplicating the alert message in helperText. */
  const [authInvalid, setAuthInvalid] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!resetBanner) return;
    alertRef.current?.focus();
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") === "1") {
      url.searchParams.delete("reset");
      const qs = url.searchParams.toString();
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
      );
    }
  }, [resetBanner]);

  useEffect(() => {
    if (focusNonce > 0) {
      alertRef.current?.focus();
    }
  }, [focusNonce]);

  function announceFailure(message: string, nextFields: FieldErrors, fromAuth: boolean) {
    setError(message);
    setFieldErrors(nextFields);
    setAuthInvalid(fromAuth);
    setResetBanner(false);
    setFocusNonce((n) => n + 1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setAuthInvalid(false);
    const form = new FormData(event.currentTarget);
    const raw = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") {
          if (!next[key]) next[key] = issue.message;
        }
      }
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      announceFailure(message, next, false);
      return;
    }

    setPending(true);
    try {
      const result = await signIn("credentials", {
        email: normalizeEmail(parsed.data.email),
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        announceFailure(
          "Could not sign in. Check your email and password.",
          {},
          true,
        );
        return;
      }
      const rawCallback = searchParams.get("callbackUrl");
      const nextPath = getSafeCallbackPath(rawCallback, {
        defaultPath: "/home",
        sameOrigin: window.location.origin,
      });
      // Full navigation so /home lands like a refresh (shell layout + scroll at top).
      window.location.assign(nextPath);
    } finally {
      setPending(false);
    }
  }

  const emailDescribedBy = fieldErrors.email
    ? "login-email-helper"
    : authInvalid || error
      ? "login-form-error"
      : undefined;
  const passwordDescribedBy = fieldErrors.password
    ? "login-password-helper"
    : authInvalid || error
      ? "login-form-error"
      : undefined;

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
          Login
        </Typography>

        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit}
          noValidate
          sx={{ width: "100%", maxWidth: 400 }}
        >
          {error ? (
            <Alert
              ref={alertRef}
              id="login-form-error"
              severity="error"
              tabIndex={-1}
              role="alert"
            >
              {error}
            </Alert>
          ) : resetBanner ? (
            <Alert
              ref={alertRef}
              id="login-form-success"
              severity="success"
              tabIndex={-1}
              role="status"
            >
              Your password was updated. Sign in with your new password.
            </Alert>
          ) : null}
          <TextField
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            fullWidth
            error={Boolean(fieldErrors.email) || authInvalid}
            helperText={fieldErrors.email}
            FormHelperTextProps={
              fieldErrors.email ? { id: "login-email-helper" } : undefined
            }
            slotProps={{
              htmlInput: {
                "aria-invalid":
                  Boolean(fieldErrors.email) || authInvalid || undefined,
                "aria-describedby": emailDescribedBy,
              },
            }}
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            fullWidth
            error={Boolean(fieldErrors.password) || authInvalid}
            helperText={fieldErrors.password}
            FormHelperTextProps={
              fieldErrors.password ? { id: "login-password-helper" } : undefined
            }
            slotProps={{
              htmlInput: {
                "aria-invalid":
                  Boolean(fieldErrors.password) || authInvalid || undefined,
                "aria-describedby": passwordDescribedBy,
              },
            }}
          />
          <Button type="submit" variant="contained" size="large" disabled={pending} fullWidth>
            {pending ? "Logging in…" : "Login"}
          </Button>
          <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ width: "100%" }}>
            <Link component={NextLink} href="/forgot-password" variant="body2">
              Forgot password?
            </Link>
            <Link component={NextLink} href="/create-account" variant="body2">
              Create account
            </Link>
          </Stack>
        </Stack>
      </Stack>
    </>
  );
}
