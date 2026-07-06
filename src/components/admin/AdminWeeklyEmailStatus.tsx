"use client";

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { EmailJobRowStatus, WeeklyEmailStatus } from "@/lib/admin/get-weekly-email-status";

export type AdminWeeklyEmailStatusProps = {
  status?: WeeklyEmailStatus;
  loadError?: boolean;
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rowLabel(
  jobName: string,
  row: EmailJobRowStatus,
): { severity: "success" | "info" | "warning"; text: string } {
  switch (row.state) {
    case "sent":
      return {
        severity: "success",
        text: `${jobName} — Sent ${formatSentAt(row.sentAtIso)}`,
      };
    case "skipped":
      return {
        severity: "info",
        text: `${jobName} — Skipped (all picks submitted)`,
      };
    case "pending":
      return {
        severity: "info",
        text: `${jobName} — Pending (scheduled)`,
      };
    case "not_sent":
      return {
        severity: "warning",
        text: `${jobName} — Not sent`,
      };
  }
}

export function AdminWeeklyEmailStatus({ status, loadError }: AdminWeeklyEmailStatusProps) {
  const rows = status
    ? [
        rowLabel("Tuesday digest", status.tuesdayDigest),
        rowLabel("Wednesday reminder", status.wednesdayReminder),
        rowLabel("Thursday reminder", status.thursdayReminder),
      ]
    : [];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h5" component="h2">
          Email automation status
        </Typography>
        {loadError ? (
          <Alert severity="warning" variant="outlined">
            Could not load email automation status. Try refreshing the page.
          </Alert>
        ) : (
          <>
            {status?.weekNumber != null ? (
              <Typography variant="body2" color="text.secondary">
                Week {status.weekNumber}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Status appears once the season and schedule are active
              </Typography>
            )}
            <Stack spacing={1}>
              {rows.map((row) => (
                <Alert key={row.text} severity={row.severity} variant="outlined">
                  {row.text}
                </Alert>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}
