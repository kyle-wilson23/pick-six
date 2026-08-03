"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { SkipLink } from "@/components/a11y/SkipLink";
import { createAccountBodySchema } from "@/lib/create-account";
import {
  SIGNUP_PASSWORD_POLICY_MESSAGE,
} from "@/lib/invitations";
import { normalizeEmail } from "@/lib/normalize-email";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

const formSchema = createAccountBodySchema
  .extend({
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function CreateAccountClient() {
  const alertRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [signInRecovery, setSignInRecovery] = useState(false);
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
    if (submittingRef.current) {
      return;
    }

    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setSignInRecovery(false);

    const form = new FormData(event.currentTarget);
    const raw = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      let nextEmail: string | null = null;
      let nextPassword: string | null = null;
      let nextConfirm: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" && !nextEmail) nextEmail = issue.message;
        if (key === "password" && !nextPassword) nextPassword = issue.message;
        if (key === "confirmPassword" && !nextConfirm) nextConfirm = issue.message;
      }
      setEmailError(nextEmail);
      setPasswordError(nextPassword);
      setConfirmError(nextConfirm);
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      setError(message);
      announceAlert();
      return;
    }

    submittingRef.current = true;
    setPending(true);
    let accountCreated = false;
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        let code: string | undefined;
        try {
          const data = (await res.json()) as {
            error?: { code?: string; message?: string };
          };
          if (data?.error?.message) {
            msg = data.error.message;
          }
          code = data?.error?.code;
        } catch {
          /* keep generic message */
        }
        setError(msg);
        if (res.status === 409 || code === "EMAIL_IN_USE") {
          setEmailError(msg);
        } else if (code === "PASSWORD_POLICY") {
          setPasswordError(msg);
        }
        announceAlert();
        return;
      }

      accountCreated = true;
      const email = normalizeEmail(parsed.data.email);
      const result = await signIn("credentials", {
        email,
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        setSignInRecovery(true);
        announceAlert();
        return;
      }

      window.location.assign("/home");
    } catch {
      if (accountCreated) {
        setSignInRecovery(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
      announceAlert();
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const showBanner = Boolean(error) || signInRecovery;
  const passwordHelper = passwordError ?? SIGNUP_PASSWORD_POLICY_MESSAGE;
  const emailDescribedBy = [
    emailError ? "create-account-email-helper" : null,
    showBanner ? "create-account-form-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const passwordDescribedBy = [
    "create-account-password-helper",
    showBanner ? "create-account-form-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const confirmDescribedBy = [
    confirmError ? "create-account-confirm-helper" : null,
    showBanner ? "create-account-form-error" : null,
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
          Create account
        </Typography>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
          Register to use Pick Six. Join a league later via an invite from your league admin.
        </Typography>

        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit}
          noValidate
          sx={{ width: "100%", maxWidth: 400 }}
        >
          {signInRecovery ? (
            <Alert
              ref={alertRef}
              id="create-account-form-error"
              severity="warning"
              tabIndex={-1}
              role="alert"
            >
              Your account was created, but automatic sign-in did not complete. Please{" "}
              <Link component={NextLink} href="/login">
                sign in
              </Link>{" "}
              with your email and password.
            </Alert>
          ) : error ? (
            <Alert
              ref={alertRef}
              id="create-account-form-error"
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
            error={Boolean(emailError)}
            helperText={emailError}
            FormHelperTextProps={
              emailError ? { id: "create-account-email-helper" } : undefined
            }
            slotProps={{
              htmlInput: {
                "aria-invalid": Boolean(emailError) || undefined,
                "aria-describedby": emailDescribedBy || undefined,
              },
            }}
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            required
            fullWidth
            error={Boolean(passwordError)}
            helperText={passwordHelper}
            FormHelperTextProps={{ id: "create-account-password-helper" }}
            slotProps={{
              htmlInput: {
                "aria-invalid": Boolean(passwordError) || undefined,
                "aria-describedby": passwordDescribedBy,
              },
            }}
          />
          <TextField
            name="confirmPassword"
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            required
            fullWidth
            error={Boolean(confirmError)}
            helperText={confirmError}
            FormHelperTextProps={
              confirmError ? { id: "create-account-confirm-helper" } : undefined
            }
            slotProps={{
              htmlInput: {
                "aria-invalid": Boolean(confirmError) || undefined,
                "aria-describedby": confirmDescribedBy || undefined,
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={pending}
            fullWidth
          >
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </Stack>

        <Link component={NextLink} href="/login" variant="body2">
          Back to login
        </Link>
      </Stack>
    </>
  );
}
