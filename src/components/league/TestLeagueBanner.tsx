"use client";

import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** Persistent rehearsal labeling — distinct from `PicksPreviewBanner`. */
export function TestLeagueBanner() {
  return (
    <Alert severity="info">
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" component="p" fontWeight={600}>
          Test / rehearsal league
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Practice data only — not your real season standings or picks.
        </Typography>
      </Stack>
    </Alert>
  );
}
