"use client";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export type AdminSubmissionCardProps = {
  displayName: string;
  submittedPick: {
    teamName: string;
    antiJailedBonus: boolean;
    updatedAt: string;
  } | null;
};

const ANTI_JAILED_BONUS_LABEL = "+2";

function formatSubmittedTimestamp(isoUtc: string): string {
  const d = new Date(isoUtc);
  return isNaN(d.getTime()) ? isoUtc : d.toLocaleString();
}

function buildDetailLine(
  submittedPick: AdminSubmissionCardProps["submittedPick"],
): string {
  if (!submittedPick) {
    return "No pick submitted yet";
  }

  const teamLabel = submittedPick.antiJailedBonus
    ? `Picked: ${submittedPick.teamName} (${ANTI_JAILED_BONUS_LABEL})`
    : `Picked: ${submittedPick.teamName}`;

  return `${teamLabel} — submitted ${formatSubmittedTimestamp(submittedPick.updatedAt)}`;
}

export function AdminSubmissionCard({ displayName, submittedPick }: AdminSubmissionCardProps) {
  const isSubmitted = submittedPick != null;
  const statusLabel = isSubmitted ? "SUBMITTED" : "PENDING";
  const paletteKey = isSubmitted ? "success" : "warning";

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: "background.paper",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="body1">{displayName}</Typography>
          <Chip
            label={statusLabel}
            size="small"
            sx={{
              bgcolor: (t) => `${t.palette[paletteKey].main}26`,
              color: (t) => t.palette[paletteKey].main,
              fontWeight: 600,
            }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {buildDetailLine(submittedPick)}
        </Typography>
      </Stack>
    </Paper>
  );
}
