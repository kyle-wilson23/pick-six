"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { PicksWeekMatchupJson } from "@/lib/picks/picks-week-view-types";

import { MatchupCard } from "./MatchupCard";

export type WeekMatchupListProps = {
  weekLabel: number;
  matchups: PicksWeekMatchupJson[];
  /** Earliest UTC pick deadline instant for countdown (Story 3.7). */
  pickDeadlineUtc?: string | null;
  /** Jailed team for the week — passed through to each MatchupCard for Story 3.7 visual blocking. */
  jailedTeamId?: string | null;
  /** Story 3.7 hook props forwarded to each MatchupCard. */
  onTeamSelect?: (teamId: string) => void;
  selectedTeamId?: string | null;
  pickedTeamIds?: string[];
};

export function WeekMatchupList({
  weekLabel,
  matchups,
  jailedTeamId,
  onTeamSelect,
  selectedTeamId,
  pickedTeamIds,
}: WeekMatchupListProps) {
  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h6" component="h2">
        Week {weekLabel} Matchups
      </Typography>

      {matchups.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No games are scheduled or loaded for this week yet.
        </Typography>
      ) : (
        matchups.map((m) => (
          <MatchupCard
            key={m.gameId}
            matchup={m}
            jailedTeamId={jailedTeamId}
            onTeamSelect={onTeamSelect}
            selectedTeamId={selectedTeamId}
            pickedTeamIds={pickedTeamIds}
          />
        ))
      )}
    </Stack>
  );
}
