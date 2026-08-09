"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { PasswordTextField } from "@/components/auth/PasswordTextField";
import {
  SIGNUP_PASSWORD_POLICY_MESSAGE,
  signupPasswordFieldSchema,
} from "@/lib/invitations";

const formSchema = z
  .object({
    password: signupPasswordFieldSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const alertRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
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
    setConfirmError(null);

    const form = new FormData(event.currentTarget);
    const raw = {
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    };
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      let nextPassword: string | null = null;
      let nextConfirm: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "password" && !nextPassword) nextPassword = issue.message;
        if (key === "confirmPassword" && !nextConfirm) nextConfirm = issue.message;
      }
      setPasswordError(nextPassword);
      setConfirmError(nextConfirm);
      const message = parsed.error.issues[0]?.message ?? "Invalid input.";
      setError(message);
      announceAlert();
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: parsed.data.password,
        }),
      });

      if (!res.ok) {
        let msg =
          "This reset link is invalid or has expired. Request a new password reset link.";
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

      router.push("/login?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
      announceAlert();
    } finally {
      setPending(false);
    }
  }

  const showBanner = Boolean(error);
  const passwordHelper = passwordError ?? SIGNUP_PASSWORD_POLICY_MESSAGE;
  const passwordDescribedBy = [
    "reset-password-helper",
    showBanner ? "reset-form-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const confirmDescribedBy = [
    confirmError ? "reset-confirm-helper" : null,
    showBanner ? "reset-form-error" : null,
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
      {error ? (
        <Alert ref={alertRef} id="reset-form-error" severity="error" tabIndex={-1} role="alert">
          {error}
        </Alert>
      ) : null}
      <PasswordTextField
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        fullWidth
        error={Boolean(passwordError)}
        helperText={passwordHelper}
        FormHelperTextProps={{ id: "reset-password-helper" }}
        slotProps={{
          htmlInput: {
            "aria-invalid": Boolean(passwordError) || undefined,
            "aria-describedby": passwordDescribedBy,
          },
        }}
      />
      <PasswordTextField
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        required
        fullWidth
        error={Boolean(confirmError)}
        helperText={confirmError}
        FormHelperTextProps={
          confirmError ? { id: "reset-confirm-helper" } : undefined
        }
        slotProps={{
          htmlInput: {
            "aria-invalid": Boolean(confirmError) || undefined,
            "aria-describedby": confirmDescribedBy || undefined,
          },
        }}
      />
      <Button type="submit" variant="contained" size="large" disabled={pending} fullWidth>
        {pending ? "Updating…" : "Set new password"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        Need a new link?{" "}
        <Link component={NextLink} href="/forgot-password">
          Request password reset
        </Link>
      </Typography>
    </Stack>
  );
}
