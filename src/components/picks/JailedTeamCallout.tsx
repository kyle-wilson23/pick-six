"use client";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { TeamLogo } from "./TeamLogo";

function formatAmericanMl(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}

export type JailedTeamCalloutProps = {
  team: { id: string; abbreviation: string; name: string };
  moneylineAmerican: number | null;
};

/**
 * Story 3.7 — descriptive (non-interactive) callout above the matchup list (FR18 / FR25).
 * Communicates the jailed team and the anti-jailed bonus path. Visual: warning palette card.
 */
export function JailedTeamCallout({ team, moneylineAmerican }: JailedTeamCalloutProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: (t) => `${t.palette.warning.main}1A`, // ~10% opacity
        border: (t) => `1px solid ${t.palette.warning.main}4D`, // ~30% opacity
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TeamLogo
          abbreviation={team.abbreviation}
          teamName={team.name}
          size="md"
          jailed
        />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="warning.main" fontWeight={700}>
            <span aria-hidden style={{ marginRight: 6 }}>🔒</span>
            Jailed this week: {team.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ML {formatAmericanMl(moneylineAmerican)} · biggest favorite — cannot be picked directly.
            Pick <strong>against</strong> for a 2-point bonus.
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
