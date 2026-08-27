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
    >
      <Typography id={headingId} variant="h6" component="h2">
        Teams on Bye
      </Typography>
      <Stack
        component="ul"
        direction="row"
        flexWrap="wrap"
        useFlexGap
        spacing={1.5}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {teams.map((team) => (
          <Stack
            key={team.id}
            component="li"
            direction="row"
            spacing={1}
            alignItems="center"
          >
            <TeamLogo
              abbreviation={team.abbreviation}
              teamName={team.name}
              size="sm"
            />
            <Typography variant="body2">{team.name}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
