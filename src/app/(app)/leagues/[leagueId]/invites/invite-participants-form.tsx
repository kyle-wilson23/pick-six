"use client";

import { useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { normalizeInviteEmailList } from "@/lib/league/create-invitations-body";

type ApiError = { error?: { code?: string; message?: string } };

type InvitationsSuccessBody = {
  created: number;
  sent?: number;
  failed?: number;
};

function parseEmailsFromText(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/);
  return normalizeInviteEmailList(parts);
}

function successCopy(body: InvitationsSuccessBody): string {
  const created = body.created;
  const sent = body.sent ?? created;
  const failed = body.failed ?? 0;
  if (failed > 0) {
    return `Created ${created} invitation${created === 1 ? "" : "s"}; ${sent} email${sent === 1 ? "" : "s"} sent. ${failed} failed — send again for those addresses.`;
  }
  return `Sent ${created} invitation${created === 1 ? "" : "s"}. Each recipient will receive an email with a signup link.`;
}

type Props = { leagueId: string };

export function InviteParticipantsForm({ leagueId }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
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
      if (
        data &&
        typeof data === "object" &&
        "created" in data &&
        typeof (data as { created: unknown }).created === "number"
      ) {
        setSuccessMessage(successCopy(data as InvitationsSuccessBody));
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
        disabled={submitting}
      />
      {successMessage ? (
        <Typography variant="body2" color="success.main">
          {successMessage}
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
      <Dialog
        open={submitting}
        disableEscapeKeyDown
        aria-labelledby="invite-sending-title"
        aria-describedby="invite-sending-title"
      >
        <DialogContent>
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ py: 2, px: 1, minWidth: 260 }}
            aria-busy="true"
            aria-live="polite"
          >
            <CircularProgress color="primary" aria-hidden />
            <Typography id="invite-sending-title" variant="body1" textAlign="center">
              Invitations are being sent. Please wait.
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
