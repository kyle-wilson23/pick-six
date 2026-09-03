"use client";

import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function PicksPreviewBanner() {
  return (
    <Alert severity="info">
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" component="p" fontWeight={600}>
          Preview – picks not yet open
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You can review this week&apos;s matchups and lines. Picks for this week open on the Tuesday
          before its first game.
        </Typography>
      </Stack>
    </Alert>
  );
}
