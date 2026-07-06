"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AlreadyRegisteredInviteMode = "accept" | "wrong_account" | "sign_in";

type AlreadyRegisteredInviteProps = {
  mode: AlreadyRegisteredInviteMode;
  token: string;
  loginHref: string;
  invitedEmail: string;
  currentEmail?: string;
  leagueName: string | null;
};

export function AlreadyRegisteredInvite({
  mode,
  token,
  loginHref,
  invitedEmail,
  currentEmail,
  leagueName,
}: AlreadyRegisteredInviteProps) {
  if (mode === "accept") {
    return (
      <AcceptInviteForm
        token={token}
        invitedEmail={invitedEmail}
        leagueName={leagueName}
      />
    );
  }

  if (mode === "wrong_account" && currentEmail) {
    return (
      <WrongAccountForInvite
        loginHref={loginHref}
        currentEmail={currentEmail}
        invitedEmail={invitedEmail}
        leagueName={leagueName}
      />
    );
  }

  return (
    <SignInToAcceptInvite
      loginHref={loginHref}
      invitedEmail={invitedEmail}
      leagueName={leagueName}
    />
  );
}

type AcceptInviteFormProps = {
  token: string;
  invitedEmail: string;
  leagueName: string | null;
};

function AcceptInviteForm({ token, invitedEmail, leagueName }: AcceptInviteFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAccept() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/signup/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        let msg = "This invitation link is invalid or has expired.";
        try {
          const data = (await res.json()) as { error?: { code?: string; message?: string } };
          if (data?.error?.message) {
            msg = data.error.message;
          }
        } catch {
          /* keep generic */
        }
        setError(msg);
        return;
      }

      const data = (await res.json()) as { leagueId?: string | null };
      if (data.leagueId) {
        router.push(`/leagues/${data.leagueId}`);
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 400 }}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Typography variant="body1" color="text.secondary">
        Signed in as <strong>{invitedEmail}</strong>
        {leagueName ? (
          <>
            {" "}
            — accept this invitation to join <strong>{leagueName}</strong>.
          </>
        ) : (
          "."
        )}
      </Typography>
      <Button variant="contained" size="large" disabled={pending} onClick={handleAccept} fullWidth>
        {pending ? "Joining league…" : leagueName ? `Join ${leagueName}` : "Accept invitation"}
      </Button>
    </Stack>
  );
}

type SignInToAcceptProps = {
  loginHref: string;
  invitedEmail: string;
  leagueName: string | null;
};

function SignInToAcceptInvite({ loginHref, invitedEmail, leagueName }: SignInToAcceptProps) {
  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 400 }}>
      <Alert severity="info">
        An account already exists for <strong>{invitedEmail}</strong>. Sign in to accept this
        invitation{leagueName ? ` and join ${leagueName}` : ""}.
      </Alert>
      <Button variant="contained" size="large" component={Link} href={loginHref} fullWidth>
        Sign in to accept
      </Button>
    </Stack>
  );
}

type WrongAccountForInviteProps = {
  loginHref: string;
  currentEmail: string;
  invitedEmail: string;
  leagueName: string | null;
};

function WrongAccountForInvite({
  loginHref,
  currentEmail,
  invitedEmail,
  leagueName,
}: WrongAccountForInviteProps) {
  const [pending, setPending] = useState(false);

  async function handleSwitchAccount() {
    setPending(true);
    await signOut({ callbackUrl: loginHref });
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 400 }}>
      <Alert severity="warning">
        You&apos;re signed in as <strong>{currentEmail}</strong>, but this invitation is for{" "}
        <strong>{invitedEmail}</strong>
        {leagueName ? ` to join ${leagueName}` : ""}. Sign out first, then sign in with the invited
        email.
      </Alert>
      <Button
        variant="contained"
        size="large"
        disabled={pending}
        onClick={handleSwitchAccount}
        fullWidth
      >
        {pending ? "Signing out…" : "Sign out and sign in"}
      </Button>
    </Stack>
  );
}
