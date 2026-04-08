"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { getSafeCallbackPath } from "@/lib/callback-url";
import { normalizeEmail } from "@/lib/normalize-email";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const raw = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
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
        setError("Could not sign in. Check your email and password.");
        return;
      }
      const rawCallback = searchParams.get("callbackUrl");
      const nextPath = getSafeCallbackPath(rawCallback, {
        defaultPath: "/dashboard",
        sameOrigin: window.location.origin,
      });
      router.push(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h4" component="h1">
        Login
      </Typography>

      <Stack
        component="form"
        spacing={2}
        onSubmit={handleSubmit}
        sx={{ width: "100%", maxWidth: 400 }}
      >
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          fullWidth
        />
        <Button type="submit" variant="contained" size="large" disabled={pending} fullWidth>
          {pending ? "Logging in…" : "Login"}
        </Button>
      </Stack>

      <Link component={NextLink} href="/" variant="body2" color="text.secondary">
        Back to home
      </Link>
    </Stack>
  );
}
