"use client";

import CheckCircle from "@mui/icons-material/CheckCircle";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { UserIdentityCell } from "@/components/user/UserIdentityCell";
import {
  isAdminSubmittedPickVisible,
  type AdminSubmittedPick,
} from "@/lib/admin/submitted-pick";

export type AdminSubmissionCardProps = {
  displayName: string;
  imageUrl?: string | null;
  submittedPick: AdminSubmittedPick | null;
  onOverride?: () => void;
};

const ANTI_JAILED_BONUS_LABEL = "+2";

function formatSubmittedTimestamp(isoUtc: string): string {
  const d = new Date(isoUtc);
  return isNaN(d.getTime()) ? isoUtc : d.toLocaleString();
}

function buildDetailLine(submittedPick: AdminSubmittedPick | null): string {
  if (!submittedPick) {
    return "No pick submitted yet";
  }

  if (!isAdminSubmittedPickVisible(submittedPick)) {
    return `Submitted ${formatSubmittedTimestamp(submittedPick.updatedAt)}`;
  }

  const teamLabel = submittedPick.antiJailedBonus
    ? `Picked: ${submittedPick.teamName} (${ANTI_JAILED_BONUS_LABEL})`
    : `Picked: ${submittedPick.teamName}`;

  return `${teamLabel} — submitted ${formatSubmittedTimestamp(submittedPick.updatedAt)}`;
}

export function AdminSubmissionCard({
  displayName,
  imageUrl = null,
  submittedPick,
  onOverride,
}: AdminSubmissionCardProps) {
  const isSubmitted = submittedPick != null;
  const teamVisible = isAdminSubmittedPickVisible(submittedPick);
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
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <UserIdentityCell
              displayName={displayName}
              imageUrl={imageUrl}
              typographyVariant="body1"
            />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
            {isSubmitted && !teamVisible ? (
              <CheckCircle aria-label="Pick submitted" color="success" fontSize="small" />
            ) : null}
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
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {buildDetailLine(submittedPick)}
        </Typography>
        {onOverride != null && (
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="outlined" size="small" onClick={onOverride}>
              {submittedPick == null ? "Override pick" : "Change pick"}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
