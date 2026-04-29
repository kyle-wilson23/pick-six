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
          You can review this week&apos;s matchups and lines, but pick submission opens when your league&apos;s competition
          window starts.
        </Typography>
      </Stack>
    </Alert>
  );
}
