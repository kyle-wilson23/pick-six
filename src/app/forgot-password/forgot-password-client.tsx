"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";

import { SkipLink } from "@/components/a11y/SkipLink";
import { forgotPasswordBodySchema } from "@/lib/password-reset";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

const SUCCESS_MESSAGE =
  "If an account exists for that email, we've sent a password reset link. Check your inbox.";

export function ForgotPasswordClient() {
  const alertRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (focusNonce > 0) {
      alertRef.current?.focus();
    }
  }, [focusNonce]);

  function announceAlert() {
    setFocusNonce((n) => n + 1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEmailError(null);
    setSuccess(false);

    const form = new FormData(event.currentTarget);
    const raw = { email: String(form.get("email") ?? "") };
    const parsed = forgotPasswordBodySchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      setEmailError(message);
      setError(message);
      announceAlert();
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try {
          const data = (await res.json()) as {
            error?: { code?: string; message?: string };
          };
          if (data?.error?.message) {
            msg = data.error.message;
          }
        } catch {
          /* keep generic message */
        }
        setError(msg);
        announceAlert();
        return;
      }

      setSuccess(true);
      announceAlert();
    } catch {
      setError("Something went wrong. Please try again.");
      announceAlert();
    } finally {
      setPending(false);
    }
  }

  const emailDescribedBy = [
    emailError ? "forgot-email-helper" : null,
    error ? "forgot-form-error" : null,
    success ? "forgot-form-success" : null,
  ]
    .filter(Boolean)
    .join(" ");

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
          Forgot password
        </Typography>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
          Enter your email and we&apos;ll send you a link to reset your password.
        </Typography>

        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit}
          noValidate
          sx={{ width: "100%", maxWidth: 400 }}
        >
          {success ? (
            <Alert
              ref={alertRef}
              id="forgot-form-success"
              severity="success"
              tabIndex={-1}
              role="status"
            >
              {SUCCESS_MESSAGE}
            </Alert>
          ) : error ? (
            <Alert
              ref={alertRef}
              id="forgot-form-error"
              severity="error"
              tabIndex={-1}
              role="alert"
            >
              {error}
            </Alert>
          ) : null}

          <TextField
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            required
            fullWidth
            disabled={success}
            error={Boolean(emailError)}
            helperText={emailError}
            FormHelperTextProps={
              emailError ? { id: "forgot-email-helper" } : undefined
            }
            slotProps={{
              htmlInput: {
                "aria-invalid": Boolean(emailError) || undefined,
                "aria-describedby": emailDescribedBy || undefined,
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending || success}
            fullWidth
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </Stack>

        <Link component={NextLink} href="/login" variant="body2">
          Back to login
        </Link>
      </Stack>
    </>
  );
}
