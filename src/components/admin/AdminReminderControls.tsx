"use client";

import { useCallback, useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export type AdminReminderControlsProps = {
  leagueId: string;
  weekNumber: number | null;
  outstandingCount: number;
};

type ConfigResponse = {
  weekNumber: number | null;
  wednesdayReminderSentAt: string | null;
  thursdayReminderSentAt: string | null;
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AdminReminderControls({
  leagueId,
  weekNumber,
  outstandingCount,
}: AdminReminderControlsProps) {
  const [activeWeekNumber, setActiveWeekNumber] = useState<number | null>(weekNumber);
  const [wednesdaySentAt, setWednesdaySentAt] = useState<string | null>(null);
  const [thursdaySentAt, setThursdaySentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingWednesday, setSendingWednesday] = useState(false);
  const [sendingThursday, setSendingThursday] = useState(false);
  const [wednesdayMessage, setWednesdayMessage] = useState<string | null>(null);
  const [thursdayMessage, setThursdayMessage] = useState<string | null>(null);
  const [wednesdayError, setWednesdayError] = useState<string | null>(null);
  const [thursdayError, setThursdayError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const configUrl = `/api/leagues/${leagueId}/email/tuesday-config`;
  const wednesdayUrl = `/api/leagues/${leagueId}/email/wednesday-reminder`;
  const thursdayUrl = `/api/leagues/${leagueId}/email/thursday-reminder`;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(configUrl);
      if (!res.ok) {
        throw new Error("Failed to load reminder config");
      }
      const data = (await res.json()) as ConfigResponse & {
        bodyText?: string | null;
        sentAt?: string | null;
      };
      setWednesdaySentAt(data.wednesdayReminderSentAt ?? null);
      setThursdaySentAt(data.thursdayReminderSentAt ?? null);
      if (data.weekNumber != null) {
        setActiveWeekNumber(data.weekNumber);
      }
    } catch {
      setConfigError("Could not load reminder settings");
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

  async function handleSend(
    reminderType: "wednesday" | "thursday",
    force = false,
  ) {
    const url = reminderType === "wednesday" ? wednesdayUrl : thursdayUrl;
    const setSending =
      reminderType === "wednesday" ? setSendingWednesday : setSendingThursday;
    const setMessage =
      reminderType === "wednesday" ? setWednesdayMessage : setThursdayMessage;
    const setError =
      reminderType === "wednesday" ? setWednesdayError : setThursdayError;
    const setSentAt =
      reminderType === "wednesday" ? setWednesdaySentAt : setThursdaySentAt;

    setSending(true);
    setMessage(null);
    setError(null);

    try {
      const requestUrl = force ? `${url}?force=true` : url;
      const res = await fetch(requestUrl, { method: "POST" });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        skipped?: number;
        sentAt?: string | null;
        error?: { code: string; message: string };
      };

      if (res.status === 409 && data.error?.code === "ALREADY_SENT") {
        setError("Already sent — add ?force=true to resend");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Send failed");
      }

      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;

      if (sent === 0) {
        setError(
          failed > 0
            ? `Send failed — ${failed} member${failed > 1 ? "s" : ""} could not be reached.`
            : "All members have already submitted picks.",
        );
        return;
      }

      if (data.sentAt) {
        setSentAt(data.sentAt);
        setMessage(`Sent at ${formatSentAt(data.sentAt)} — ${sent} member${sent > 1 ? "s" : ""} reached.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const noActiveWeek = activeWeekNumber == null;
  const allSubmitted = outstandingCount === 0;
  const memberLabel = outstandingCount === 1 ? "member" : "members";

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        {noActiveWeek ? (
          <Typography variant="body2" color="text.secondary">
            No active week for reminders
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {allSubmitted
              ? "All members have submitted picks"
              : `${outstandingCount} ${memberLabel} haven't submitted a pick for Week ${activeWeekNumber}`}
          </Typography>
        )}

        {configError != null ? (
          <Alert severity="warning">{configError}</Alert>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Stack spacing={0.5}>
            <Button
              variant="outlined"
              color="info"
              onClick={() => void handleSend("wednesday")}
              disabled={noActiveWeek || loading || sendingWednesday || allSubmitted}
              sx={{ minHeight: 48 }}
            >
              {sendingWednesday ? "Sending…" : "Send Wednesday Reminder"}
            </Button>
            {wednesdaySentAt != null ? (
              <Typography variant="caption" color="text.secondary">
                Last sent: {formatSentAt(wednesdaySentAt)}
              </Typography>
            ) : null}
            {wednesdayMessage != null ? (
              <Alert severity="success" sx={{ py: 0 }}>{wednesdayMessage}</Alert>
            ) : null}
            {wednesdayError != null ? (
              <Alert severity="warning" sx={{ py: 0 }}>{wednesdayError}</Alert>
            ) : null}
          </Stack>

          <Stack spacing={0.5}>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => void handleSend("thursday")}
              disabled={noActiveWeek || loading || sendingThursday || allSubmitted}
              sx={{ minHeight: 48 }}
            >
              {sendingThursday ? "Sending…" : "Send Thursday Reminder"}
            </Button>
            {thursdaySentAt != null ? (
              <Typography variant="caption" color="text.secondary">
                Last sent: {formatSentAt(thursdaySentAt)}
              </Typography>
            ) : null}
            {thursdayMessage != null ? (
              <Alert severity="success" sx={{ py: 0 }}>{thursdayMessage}</Alert>
            ) : null}
            {thursdayError != null ? (
              <Alert severity="warning" sx={{ py: 0 }}>{thursdayError}</Alert>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
