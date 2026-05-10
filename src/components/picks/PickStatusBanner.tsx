"use client";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { TeamLogo } from "./TeamLogo";

export type PickStatusBannerProps = {
  teamName: string | null;
  teamAbbreviation: string | null;
  antiJailedBonus: boolean;
  /** True when the pick window has closed for the active week (FR27 / Story 3.5). */
  isLocked: boolean;
  weekNumber: number;
};

/**
 * Story 3.7 — persistent confirmation banner above the matchup list (FR22).
 *
 * Variants per **UX § Component Strategy → PickStatusBanner**:
 * - **submitted** (saved + open): `success.main` palette, 4px left border, "Pick submitted: …".
 * - **locked** (saved + deadline passed): `info.main` palette + lock glyph, "Your pick is locked in: …".
 * - **none + open**: nothing rendered (caller may show its own "No pick yet" microcopy).
 * - **none + locked**: a small `info`-toned "No pick saved — week is locked" line.
 */
export function PickStatusBanner({
  teamName,
  teamAbbreviation,
  antiJailedBonus,
  isLocked,
  weekNumber,
}: PickStatusBannerProps) {
  const hasPick = teamName != null && teamAbbreviation != null;

  if (!hasPick && !isLocked) {
    return null;
  }

  if (!hasPick && isLocked) {
    return (
      <Paper
        role="status"
        aria-live="polite"
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: (t) => `${t.palette.info.main}26`,
          borderLeft: (t) => `4px solid ${t.palette.info.main}`,
        }}
      >
        <Typography variant="body2" color="info.main" fontWeight={600}>
          <span aria-hidden style={{ marginRight: 6 }}>🔒</span>
          Week {weekNumber} is locked — no pick was saved.
        </Typography>
      </Paper>
    );
  }

  const points = antiJailedBonus ? "2 points" : "1 point";

  if (isLocked) {
    return (
      <Paper
        role="status"
        aria-live="polite"
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: (t) => `${t.palette.info.main}26`,
          borderLeft: (t) => `4px solid ${t.palette.info.main}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <TeamLogo
            abbreviation={teamAbbreviation as string}
            teamName={teamName as string}
            size="md"
          />
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="info.main" fontWeight={700}>
              <span aria-hidden style={{ marginRight: 6 }}>🔒</span>
              Your pick is locked in: {teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {points} · Week {weekNumber}
            </Typography>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      role="status"
      aria-live="polite"
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: (t) => `${t.palette.success.main}26`,
        borderLeft: (t) => `4px solid ${t.palette.success.main}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <TeamLogo
          abbreviation={teamAbbreviation as string}
          teamName={teamName as string}
          size="md"
        />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="success.main" fontWeight={700}>
            Your pick is submitted: {teamName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {points} · Week {weekNumber}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
