"use client";

import { useCallback, useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

export type AdminEmailComposerProps = {
  leagueId: string;
  weekNumber: number | null;
};

type ConfigResponse = {
  weekNumber: number | null;
  bodyText: string | null;
  sentAt: string | null;
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AdminEmailComposer({ leagueId, weekNumber }: AdminEmailComposerProps) {
  const [bodyText, setBodyText] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [activeWeekNumber, setActiveWeekNumber] = useState<number | null>(weekNumber);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const configUrl = `/api/leagues/${leagueId}/email/tuesday-config`;
  const previewUrl = `/api/leagues/${leagueId}/email/tuesday-preview`;
  const sendUrl = `/api/leagues/${leagueId}/email/tuesday-send`;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(configUrl);
      if (!res.ok) {
        throw new Error("Failed to load email config");
      }
      const data = (await res.json()) as ConfigResponse;
      setBodyText(data.bodyText ?? "");
      setSentAt(data.sentAt);
      if (data.weekNumber != null) {
        setActiveWeekNumber(data.weekNumber);
      }
    } catch {
      setSaveMessage("Could not load email settings");
    } finally {
      setLoading(false);
    }
  }, [configUrl]);

  useEffect(() => {
    if (weekNumber != null) {
      void loadConfig();
    } else {
      setLoading(false);
    }
  }, [weekNumber, loadConfig]);

  async function handleSave() {
    if (activeWeekNumber == null) {
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(configUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: activeWeekNumber,
          bodyText: bodyText.trim() === "" ? null : bodyText,
        }),
      });
      if (!res.ok) {
        throw new Error("Save failed");
      }
      const data = (await res.json()) as ConfigResponse;
      setBodyText(data.bodyText ?? "");
      setSentAt(data.sentAt);
      setSaveMessage("Saved");
    } catch {
      setSaveMessage("Could not save email note");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (activeWeekNumber != null) {
      await handleSave();
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSend(force = false) {
    setSending(true);
    setSendMessage(null);
    setSendError(null);
    try {
      const url = force ? `${sendUrl}?force=true` : sendUrl;
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        sentAt?: string | null;
        error?: { code: string; message: string };
      };

      if (res.status === 409 && data.error?.code === "ALREADY_SENT") {
        setSendError("Already sent — add ?force=true to resend");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Send failed");
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

      if (data.sentAt) {
        setSentAt(data.sentAt);
      }

      if (failed > 0) {
        setSendMessage(
          `Sent at ${formatSentAt(data.sentAt!)} — ${sent} sent, ${failed} failed. Use force-resend to retry failures.`,
        );
      } else {
        setSendMessage(`Sent at ${formatSentAt(data.sentAt!)} — ${sent} member${sent > 1 ? "s" : ""} reached.`);
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  if (activeWeekNumber == null) {
    return (
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No active week for email
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" component="h2">
          Week {activeWeekNumber}
        </Typography>

        <TextField
          label="Optional note for participants"
          multiline
          minRows={4}
          fullWidth
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          disabled={loading}
          placeholder="Add a custom message to include in the Tuesday email…"
        />

        {sentAt != null ? (
          <Typography variant="body2" color="text.secondary">
            Last sent: {formatSentAt(sentAt)}
          </Typography>
        ) : null}

        {saveMessage != null ? (
          <Typography variant="body2" color="text.secondary">
            {saveMessage}
          </Typography>
        ) : null}

        {sendMessage != null ? (
          <Alert severity="success">{sendMessage}</Alert>
        ) : null}

        {sendError != null ? (
          <Alert severity="warning">{sendError}</Alert>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" color="info" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving…" : "Save note"}
          </Button>
          <Button
            variant="outlined"
            color="info"
            onClick={() => void handlePreview()}
            disabled={loading || saving}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleSend()}
            disabled={loading || sending}
          >
            {sending ? "Sending…" : "Send Now"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
