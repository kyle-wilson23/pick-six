"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { skipTargetMainSx } from "@/theme/focus-visible-ring";

export default function AppLoading() {
  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      aria-busy="true"
      aria-live="polite"
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ ...skipTargetMainSx, minHeight: "50vh", px: 2, py: 6 }}
    >
      <CircularProgress color="primary" aria-hidden />
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    </Stack>
  );
}
