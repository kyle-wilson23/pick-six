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

type Feedback = {
  severity: "success" | "info" | "warning";
  message: string;
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const configUrl = `/api/leagues/${leagueId}/email/tuesday-config`;
  const wednesdayUrl = `/api/leagues/${leagueId}/email/wednesday-reminder`;
  const thursdayUrl = `/api/leagues/${leagueId}/email/thursday-reminder`;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    // A fresh load means the active week may have changed (e.g. admin just
    // advanced the rehearsal clock) — any alert from the *previous* week's
    // send attempt (like "Already sent") is stale and must not linger.
    setFeedback(null);
    setConfigError(null);
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
    const setSentAt =
      reminderType === "wednesday" ? setWednesdaySentAt : setThursdaySentAt;

    setSending(true);
    // One banner at a time — clear any prior Wed/Thu feedback before this send.
    setFeedback(null);

    try {
      const requestUrl = force ? `${url}?force=true` : url;
      const res = await fetch(requestUrl, { method: "POST" });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        skipped?: number;
        sentAt?: string | null;
        suppressed?: boolean;
        wouldSendCount?: number;
        error?: { code: string; message: string };
      };

      if (res.status === 409 && data.error?.code === "ALREADY_SENT") {
        setFeedback({
          severity: "warning",
          message: "Already sent — add ?force=true to resend",
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Send failed");
      }

      if (data.suppressed) {
        if (data.sentAt) {
          setSentAt(data.sentAt);
        }
        setFeedback({
          severity: "info",
          message: `Rehearsal sends are suppressed (TEST_LEAGUE_EMAIL_MODE=suppress) — would have reached ${data.wouldSendCount ?? 0} member(s). No email was sent.`,
        });
        return;
      }

      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;

      if (sent === 0) {
        setFeedback({
          severity: "warning",
          message:
            failed > 0
              ? `Send failed — ${failed} member${failed > 1 ? "s" : ""} could not be reached.`
              : "All members have already submitted picks.",
        });
        return;
      }

      if (data.sentAt) {
        setSentAt(data.sentAt);
        setFeedback({
          severity: "success",
          message: `Sent at ${formatSentAt(data.sentAt)} — ${sent} member${sent > 1 ? "s" : ""} reached.`,
        });
      }
    } catch (err) {
      setFeedback({
        severity: "warning",
        message: err instanceof Error ? err.message : "Send failed",
      });
    } finally {
      setSending(false);
    }
  }

  const noActiveWeek = activeWeekNumber == null;
  const allSubmitted = outstandingCount === 0;
  const memberLabel = outstandingCount === 1 ? "member" : "members";

  return (
    <Paper sx={{ p: 2, borderRadius: 2, overflow: "hidden" }}>
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

        {/*
          Always stack — this card lives in the admin side column, so a
          side-by-side row wraps button labels. Full-width column matches
          Weekly Email / Email automation status below.
        */}
        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <Stack spacing={0.5}>
            <Button
              variant="outlined"
              color="info"
              fullWidth
              onClick={() => void handleSend("wednesday")}
              disabled={noActiveWeek || loading || sendingWednesday || allSubmitted}
              sx={{ minHeight: 48, whiteSpace: "nowrap" }}
            >
              {sendingWednesday ? "Sending…" : "Send Wednesday Reminder"}
            </Button>
            {wednesdaySentAt != null ? (
              <Typography variant="caption" color="text.secondary">
                Last sent: {formatSentAt(wednesdaySentAt)}
              </Typography>
            ) : null}
          </Stack>

          <Stack spacing={0.5}>
            <Button
              variant="outlined"
              color="warning"
              fullWidth
              onClick={() => void handleSend("thursday")}
              disabled={noActiveWeek || loading || sendingThursday || allSubmitted}
              sx={{ minHeight: 48, whiteSpace: "nowrap" }}
            >
              {sendingThursday ? "Sending…" : "Send Thursday Reminder"}
            </Button>
            {thursdaySentAt != null ? (
              <Typography variant="caption" color="text.secondary">
                Last sent: {formatSentAt(thursdaySentAt)}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        {feedback != null ? (
          <Alert severity={feedback.severity} sx={{ py: 0 }}>
            {feedback.message}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
