"use client";

import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";

/** Demo chip that reads `palette.accent.gold` from the MUI theme (Story 1.1). */
export function GoldAccentChip({ label }: { label: string }) {
  const theme = useTheme();
  const bg = theme.palette.accent.gold;
  return (
    <Chip
      label={label}
      sx={{
        bgcolor: bg,
        color: theme.palette.getContrastText(bg),
        fontWeight: 600,
      }}
    />
  );
}
