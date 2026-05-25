"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Link from "next/link";

type AdminLeagueRowActionsProps = {
  leagueId: string;
};

export function AdminLeagueRowActions({ leagueId }: AdminLeagueRowActionsProps) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button
        size="small"
        variant="outlined"
        component={Link}
        href={`/leagues/${leagueId}/admin`}
      >
        Admin dashboard
      </Button>
      <Button
        size="small"
        variant="outlined"
        component={Link}
        href={`/leagues/${leagueId}/settings`}
      >
        Settings
      </Button>
      <Button
        size="small"
        variant="outlined"
        component={Link}
        href={`/leagues/${leagueId}/invites`}
      >
        Invites
      </Button>
    </Stack>
  );
}
