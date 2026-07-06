"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export type AdminExportCsvButtonProps = {
  leagueId: string;
};

export function AdminExportCsvButton({ leagueId }: AdminExportCsvButtonProps) {
  const exportUrl = `/api/leagues/${leagueId}/export`;
  const helperTextId = `admin-export-csv-helper-${leagueId}`;

  return (
    <Stack spacing={0.5} alignItems={{ xs: "stretch", md: "flex-end" }}>
      <Button
        variant="outlined"
        size="medium"
        component="a"
        href={exportUrl}
        aria-describedby={helperTextId}
      >
        Export league CSV
      </Button>
      <Typography id={helperTextId} variant="caption" color="text.secondary">
        Download full season picks and standings for spreadsheet backup
      </Typography>
    </Stack>
  );
}
