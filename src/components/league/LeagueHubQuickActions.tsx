"use client";

import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { buildLeagueTabHref } from "@/lib/league/league-nav-tabs";

type LeagueHubQuickActionsProps = {
  leagueId: string;
  seasonDescription?: string;
};

const QUICK_ACTIONS = [
  { label: "Picks", hrefSuffix: "/picks" },
  { label: "Standings", hrefSuffix: "/standings" },
  { label: "Results", hrefSuffix: "/results" },
] as const;

export function LeagueHubQuickActions({ leagueId, seasonDescription }: LeagueHubQuickActionsProps) {
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="league-hub-heading"
      sx={{
        p: { xs: 2, sm: 2.5 },
        bgcolor: "background.elevated",
        borderColor: "primary.main",
        borderWidth: 1,
      }}
    >
      <Stack spacing={2}>
        <Typography id="league-hub-heading" variant="h6" component="h2">
          League hub
        </Typography>

        {seasonDescription ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Season
            </Typography>
            <Typography variant="body1">{seasonDescription}</Typography>
          </Stack>
        ) : null}

        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="text.secondary">
            Quick actions
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ width: "100%" }}
          >
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.hrefSuffix}
                variant="contained"
                color="primary"
                size="large"
                component={Link}
                href={buildLeagueTabHref(leagueId, action.hrefSuffix)}
                sx={{ flex: { sm: 1 }, minHeight: 48 }}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
