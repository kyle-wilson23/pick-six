"use client";

import { useRef, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ADMIN_NOTE_MAX_LENGTH } from "@/lib/email/admin-note";

export type AdminOnDemandEmailCardProps = {
  leagueId: string;
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function openAdminNotePreview(leagueId: string, note: string): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `/api/leagues/${encodeURIComponent(leagueId)}/email/admin-note-preview`;
  form.target = "_blank";
  form.rel = "noopener noreferrer";
  form.acceptCharset = "UTF-8";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "note";
  input.value = note;
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function AdminOnDemandEmailCard({ leagueId }: AdminOnDemandEmailCardProps) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= ADMIN_NOTE_MAX_LENGTH;
  const sendUrl = `/api/leagues/${leagueId}/email/admin-note`;

  function handlePreview() {
    if (!canSubmit) {
      return;
    }
    openAdminNotePreview(leagueId, note);
  }

  async function handleSend() {
    if (!canSubmit || sendingRef.current) {
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendMessage(null);
    setSendInfo(null);
    setSendError(null);
    try {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        sentAt?: string | null;
        suppressed?: boolean;
        wouldSendCount?: number;
        error?: { code: string; message: string };
      };

      if (res.status === 429) {
        setSendError(data.error?.message ?? "Too many requests. Try again in a few minutes.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Send failed");
      }

      if (data.suppressed) {
        setSendInfo(
          `Rehearsal sends are suppressed (TEST_LEAGUE_EMAIL_MODE=suppress) — would have reached ${data.wouldSendCount ?? 0} member(s). No email was sent.`,
        );
        return;
      }

      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;

      if (sent === 0) {
        setSendError(
          failed > 0
            ? `Send failed — ${failed} member${failed > 1 ? "s" : ""} could not be reached. No emails were delivered.`
            : "No members to send to.",
        );
        return;
      }

      if (failed > 0) {
        const when = data.sentAt ? formatSentAt(data.sentAt) : "just now";
        setSendMessage(`Sent at ${when} — ${sent} sent, ${failed} failed.`);
      } else {
        const when = data.sentAt ? formatSentAt(data.sentAt) : "just now";
        setSendMessage(
          `Sent at ${when} — ${sent} member${sent > 1 ? "s" : ""} reached.`,
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" component="h2">
            Message participants
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sends immediately to all current participants — not the weekly digest.
          </Typography>
        </Stack>

        <TextField
          label="Note for participants"
          multiline
          minRows={4}
          fullWidth
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSendMessage(null);
            setSendInfo(null);
            setSendError(null);
          }}
          disabled={sending}
          placeholder="Write a message to send now…"
          slotProps={{ htmlInput: { maxLength: ADMIN_NOTE_MAX_LENGTH } }}
        />

        {sendMessage != null ? <Alert severity="success">{sendMessage}</Alert> : null}
        {sendInfo != null ? <Alert severity="info">{sendInfo}</Alert> : null}
        {sendError != null ? <Alert severity="warning">{sendError}</Alert> : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            color="info"
            onClick={handlePreview}
            disabled={!canSubmit || sending}
            sx={{ whiteSpace: "nowrap" }}
          >
            Save & Preview
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleSend()}
            disabled={!canSubmit || sending}
          >
            {sending ? "Sending…" : "Send Now"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
