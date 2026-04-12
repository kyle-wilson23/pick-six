"use client";

import { useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { normalizeInviteEmailList } from "@/lib/league/create-invitations-body";

type ApiError = { error?: { code?: string; message?: string } };

function parseEmailsFromText(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/);
  return normalizeInviteEmailList(parts);
}

type Props = { leagueId: string };

export function InviteParticipantsForm({ leagueId }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessCount(null);
    const emails = parseEmailsFromText(text);
    if (emails.length === 0) {
      setErrorMessage("Enter at least one valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? (data as ApiError).error?.message
            : null;
        setErrorMessage(msg ?? "Could not send invitations");
        return;
      }
      if (data && typeof data === "object" && "created" in data && typeof (data as { created: unknown }).created === "number") {
        setSuccessCount((data as { created: number }).created);
        setText("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      <TextField
        label="Email addresses"
        name="emails"
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder={"friend@example.com\nother@example.com"}
        multiline
        minRows={5}
        fullWidth
        required
        autoComplete="off"
      />
      {successCount !== null ? (
        <Typography variant="body2" color="success.main">
          Sent {successCount} invitation{successCount === 1 ? "" : "s"}. Check server logs for signup
          links in development.
        </Typography>
      ) : null}
      {errorMessage ? (
        <Typography variant="body2" color="error">
          {errorMessage}
        </Typography>
      ) : null}
      <Button type="submit" variant="contained" disabled={submitting}>
        {submitting ? "Sending…" : "Send invitations"}
      </Button>
    </Stack>
  );
}
