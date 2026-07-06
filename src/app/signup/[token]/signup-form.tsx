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
import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [signInRecovery, setSignInRecovery] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSignInRecovery(false);
    const form = new FormData(event.currentTarget);
    const raw = {
      password: String(form.get("password") ?? ""),
    };
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
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
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="form"
      spacing={2}
      onSubmit={handleSubmit}
      sx={{ width: "100%", maxWidth: 400 }}
    >
      {signInRecovery ? (
        <Alert severity="warning">
          Your account was created, but automatic sign-in did not complete. Please{" "}
          <Link component={NextLink} href={loginHref}>
            sign in
          </Link>{" "}
          with this email and your password.
        </Alert>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
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
        helperText={SIGNUP_PASSWORD_POLICY_MESSAGE}
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
