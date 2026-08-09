"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ColorModeToggle } from "@/components/color-mode/ColorModeToggle";
import { useColorMode } from "@/components/color-mode/color-mode-context";
import type { ColorMode } from "@/lib/color-mode";
import { updateProfileBodySchema } from "@/lib/profile";
import { USER_NAME_PART_MAX_LENGTH } from "@/lib/user-display-name";

type ProfileClientProps = {
  email: string;
  firstName: string;
  lastName: string;
  colorMode: ColorMode;
};

export function ProfileClient({
  email,
  firstName,
  lastName,
  colorMode: initialColorMode,
}: ProfileClientProps) {
  const router = useRouter();
  const { update } = useSession();
  const { mode, setMode } = useColorMode();
  const alertRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [pending, setPending] = useState(false);
  const [colorModePending, setColorModePending] = useState(false);
  const [colorModeError, setColorModeError] = useState<string | null>(null);
  const colorModeRequestRef = useRef(0);
  const colorModeAlertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (colorModePending) return;
    setMode(initialColorMode);
  }, [initialColorMode, colorModePending, setMode]);

  useEffect(() => {
    if (focusNonce > 0) {
      alertRef.current?.focus();
    }
  }, [focusNonce]);

  useEffect(() => {
    if (colorModeError) {
      colorModeAlertRef.current?.focus();
    }
  }, [colorModeError]);

  function announceAlert() {
    setFocusNonce((n) => n + 1);
  }

  async function persistColorMode(next: ColorMode) {
    const previous = mode;
    const requestId = ++colorModeRequestRef.current;
    setColorModeError(null);
    setColorModePending(true);
    try {
      const res = await fetch("/api/profile/color-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorMode: next }),
      });
      if (requestId !== colorModeRequestRef.current) {
        return;
      }
      if (!res.ok) {
        setMode(previous);
        setColorModeError("Could not save appearance preference. Try again.");
        return;
      }
      try {
        await update();
      } catch {
        /* DB already saved */
      }
      router.refresh();
    } catch {
      if (requestId !== colorModeRequestRef.current) {
        return;
      }
      setMode(previous);
      setColorModeError("Could not save appearance preference. Try again.");
    } finally {
      if (requestId === colorModeRequestRef.current) {
        setColorModePending(false);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    setError(null);
    setSuccess(false);
    setFirstNameError(null);
    setLastNameError(null);
    setEmailError(null);

    const form = new FormData(event.currentTarget);
    const raw = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
    };
    const parsed = updateProfileBodySchema.safeParse(raw);
    if (!parsed.success) {
      let nextFirst: string | null = null;
      let nextLast: string | null = null;
      let nextEmail: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "firstName" && !nextFirst) nextFirst = issue.message;
        if (key === "lastName" && !nextLast) nextLast = issue.message;
        if (key === "email" && !nextEmail) nextEmail = issue.message;
      }
      setFirstNameError(nextFirst);
      setLastNameError(nextLast);
      setEmailError(nextEmail);
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      announceAlert();
      return;
    }

    submittingRef.current = true;
    setPending(true);
    let saved = false;
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
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
          /* keep generic */
        }
        setError(msg);
        if (code === "EMAIL_IN_USE") {
          setEmailError(msg);
        }
        announceAlert();
        return;
      }

      saved = true;
      // Trigger JWT refresh; identity claims are loaded from DB in auth jwt callback.
      try {
        await update();
      } catch {
        /* DB already saved; layout refresh still helps RSC; next navigation reloads session */
      }
      setSuccess(true);
      announceAlert();
      router.refresh();
    } catch {
      if (!saved) {
        setError("Something went wrong. Please try again.");
        announceAlert();
      } else {
        setSuccess(true);
        announceAlert();
        router.refresh();
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <Typography variant="h4" component="h1">
        Profile
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Update your email and name. Your name appears in the nav and on league standings.
      </Typography>

      <Stack spacing={1}>
        <Typography variant="subtitle1" component="h2">
          Appearance
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Defaults to dark. Light mode uses white backgrounds across the app.
        </Typography>
        <ColorModeToggle
          disabled={colorModePending}
          onModeChange={(next) => void persistColorMode(next)}
        />
        {colorModeError ? (
          <Alert
            ref={colorModeAlertRef}
            severity="error"
            tabIndex={-1}
            role="alert"
          >
            {colorModeError}
          </Alert>
        ) : null}
      </Stack>

      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {success ? (
          <Alert ref={alertRef} severity="success" tabIndex={-1} role="status">
            Profile saved.
          </Alert>
        ) : null}
        {error ? (
          <Alert ref={alertRef} severity="error" tabIndex={-1} role="alert">
            {error}
          </Alert>
        ) : null}

        <TextField
          name="firstName"
          type="text"
          label="First name"
          autoComplete="given-name"
          required
          fullWidth
          defaultValue={firstName}
          error={Boolean(firstNameError)}
          helperText={firstNameError}
          slotProps={{ htmlInput: { maxLength: USER_NAME_PART_MAX_LENGTH } }}
        />
        <TextField
          name="lastName"
          type="text"
          label="Last name"
          autoComplete="family-name"
          required
          fullWidth
          defaultValue={lastName}
          error={Boolean(lastNameError)}
          helperText={lastNameError}
          slotProps={{ htmlInput: { maxLength: USER_NAME_PART_MAX_LENGTH } }}
        />
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          fullWidth
          defaultValue={email}
          error={Boolean(emailError)}
          helperText={emailError}
        />
        <Button type="submit" variant="contained" size="large" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </Stack>
    </Stack>
  );
}
