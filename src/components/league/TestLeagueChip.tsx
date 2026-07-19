"use client";

import Chip from "@mui/material/Chip";

type TestLeagueChipProps = {
  size?: "small" | "medium";
};

/** Compact label for lists and the league shell. */
export function TestLeagueChip({ size = "small" }: TestLeagueChipProps) {
  return (
    <Chip
      label="Test"
      size={size}
      color="info"
      variant="outlined"
      sx={{
        fontWeight: 600,
        flexShrink: 0,
      }}
    />
  );
}
