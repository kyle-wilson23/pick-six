"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { PicksWeekTeamJson } from "@/lib/picks/picks-week-view-types";

import { TeamLogo } from "./TeamLogo";

export type TeamsOnByeSectionProps = {
  teams: PicksWeekTeamJson[];
};

/**
 * Read-only list of clubs not in this week's matchups. Renders nothing when empty.
 */
const headingId = "teams-on-bye-heading";

export function TeamsOnByeSection({ teams }: TeamsOnByeSectionProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <Stack
      component="section"
      spacing={1.5}
      role="region"
      aria-labelledby={headingId}
      sx={{ pb: 2 }}
    >
      <Typography id={headingId} variant="h6" component="h2">
        Teams on Bye
      </Typography>
      <Stack
        component="ul"
        useFlexGap
        spacing={1.5}
        sx={{
          display: "grid",
          // Two columns on small screens so long names wrap instead of overflowing.
          gridTemplateColumns: {
            xs: "minmax(0, 1fr) minmax(0, 1fr)",
            md: "repeat(3, minmax(0, 1fr))",
          },
          listStyle: "none",
          m: 0,
          p: 0,
        }}
      >
        {teams.map((team) => (
          <Stack
            key={team.id}
            component="li"
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <TeamLogo
              abbreviation={team.abbreviation}
              teamName={team.name}
              size="sm"
            />
            <Typography variant="body2" sx={{ minWidth: 0 }}>
              {team.name}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
