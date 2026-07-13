"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  SIGNUP_PASSWORD_POLICY_MESSAGE,
  signupPasswordFieldSchema,
} from "@/lib/invitations";
import { normalizeEmail } from "@/lib/normalize-email";

const formSchema = z.object({
  password: signupPasswordFieldSchema,
});

type SignupFormProps = {
  token: string;
  invitedEmail: string;
  loginHref: string;
};

export function SignupForm({ token, invitedEmail, loginHref }: SignupFormProps) {
  const router = useRouter();
  const alertRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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
    setError(null);
    setPasswordError(null);
    setSignInRecovery(false);
    const form = new FormData(event.currentTarget);
    const raw = {
      password: String(form.get("password") ?? ""),
    };
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      setPasswordError(message);
      setError(message);
      announceAlert();
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/signup/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: parsed.data.password,
        }),
      });

      if (!res.ok) {
        let msg = "This invitation link is invalid or has expired.";
        try {
          const data = (await res.json()) as {
            error?: { code?: string; message?: string };
          };
          if (data?.error?.code === "PASSWORD_POLICY" && data.error.message) {
            msg = data.error.message;
          }
        } catch {
          /* keep generic invite message */
        }
        setError(msg);
        setPasswordError(msg);
        announceAlert();
        return;
      }

      const email = normalizeEmail(invitedEmail);
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
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const showBanner = Boolean(error) || signInRecovery;
  const passwordHelper = passwordError
    ? `${passwordError} ${SIGNUP_PASSWORD_POLICY_MESSAGE}`
    : SIGNUP_PASSWORD_POLICY_MESSAGE;
  const passwordDescribedBy = [
    "signup-password-helper",
    showBanner ? "signup-form-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={handleSubmit}
      noValidate
      sx={{ width: "100%", maxWidth: 400 }}
    >
      {signInRecovery ? (
        <Alert ref={alertRef} id="signup-form-error" severity="warning" tabIndex={-1} role="alert">
          Your account was created, but automatic sign-in did not complete. Please{" "}
          <Link component={NextLink} href={loginHref}>
            sign in
          </Link>{" "}
          with this email and your password.
        </Alert>
      ) : error ? (
        <Alert ref={alertRef} id="signup-form-error" severity="error" tabIndex={-1} role="alert">
          {error}
        </Alert>
      ) : null}
      <TextField
        name="email"
        type="email"
        label="Email"
        value={invitedEmail}
        disabled
        fullWidth
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
        FormHelperTextProps={{ id: "signup-password-helper" }}
        slotProps={{
          htmlInput: {
            "aria-invalid": Boolean(passwordError) || undefined,
            "aria-describedby": passwordDescribedBy,
          },
        }}
      />
      <Button type="submit" variant="contained" size="large" disabled={pending} fullWidth>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        Already have an account?{" "}
        <Link component={NextLink} href={loginHref}>
          Log in
        </Link>
      </Typography>
    </Stack>
  );
}
