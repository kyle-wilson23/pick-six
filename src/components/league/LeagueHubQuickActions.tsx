"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { buildLeagueTabHref } from "@/lib/league/league-nav-tabs";

type LeagueHubQuickActionsProps = {
  leagueId: string;
};

const QUICK_ACTIONS = [
  { label: "Picks", hrefSuffix: "/picks" },
  { label: "Standings", hrefSuffix: "/standings" },
  { label: "Results", hrefSuffix: "/results" },
] as const;

export function LeagueHubQuickActions({ leagueId }: LeagueHubQuickActionsProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" color="text.secondary">
        Quick actions
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ width: "100%" }}>
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.hrefSuffix}
            variant="outlined"
            color="primary"
            component={Link}
            href={buildLeagueTabHref(leagueId, action.hrefSuffix)}
            sx={{ flex: 1 }}
          >
            {action.label}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}
