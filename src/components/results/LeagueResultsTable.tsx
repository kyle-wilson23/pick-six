"use client";

import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { TeamLogo } from "@/components/picks/TeamLogo";
import type {
  LeaguePeerPickHistory,
  PeerPickEntry,
} from "@/lib/scoring/get-league-peer-pick-history";
import type { PickHistoryOutcome } from "@/lib/scoring/get-personal-pick-history";

type LeagueResultsTableProps = {
  history: LeaguePeerPickHistory;
  currentMembershipId: string;
};

const tabularNums = { fontVariantNumeric: "tabular-nums" } as const;

const resultMeta = {
  WIN: { label: "WIN", key: "success" as const },
  LOSS: { label: "LOSS", key: "error" as const },
} as const;

function ResultCell({ outcome }: { outcome: PickHistoryOutcome }) {
  if (outcome === "PENDING") {
    return (
      <Typography variant="body2" color="text.secondary" sx={tabularNums}>
        —
      </Typography>
    );
  }

  if (outcome === "TIE") {
    return (
      <Chip
        label="TIE"
        size="small"
        sx={{
          fontWeight: 600,
          bgcolor: (t) => `${t.palette.text.secondary}26`,
          color: "text.secondary",
        }}
      />
    );
  }

  const meta = resultMeta[outcome as keyof typeof resultMeta];
  if (!meta) return null;
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{
        fontWeight: 600,
        bgcolor: (t) => `${t.palette[meta.key].main}26`,
        color: (t) => t.palette[meta.key].main,
      }}
    />
  );
}

function AntiJailedChip() {
  return (
    <Chip
      size="small"
      label="2 PTS"
      sx={{
        fontWeight: 700,
        letterSpacing: 0.5,
        bgcolor: (t) => t.palette.accent.gold,
        color: (t) => t.palette.getContrastText(t.palette.accent.gold),
        "&:hover": {
          bgcolor: (t) => t.palette.accent.goldDark,
        },
      }}
    />
  );
}

function TeamCell({ entry }: { entry: PeerPickEntry }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <TeamLogo
        abbreviation={entry.teamAbbreviation}
        teamName={entry.teamName}
        size="sm"
      />
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flexWrap: "wrap" }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {entry.teamAbbreviation}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {entry.teamName}
        </Typography>
        {entry.antiJailedBonus ? <AntiJailedChip /> : null}
      </Stack>
    </Stack>
  );
}

export function LeagueResultsTable({ history, currentMembershipId }: LeagueResultsTableProps) {
  if (history.weeks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        League results will appear here after the first week is complete
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      {history.weeks.map((week) => (
        <Stack key={week.weekNumber} spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" component="h2">
              Week {week.weekNumber}
            </Typography>
            {!week.isRevealed ? (
              <Chip size="small" label="Not yet revealed" color="default" variant="outlined" />
            ) : null}
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "100%" }}>Participant</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Result</TableCell>
                <TableCell align="right" sx={tabularNums}>
                  Pts
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {week.entries.map((entry) => {
                const isCurrentUser = entry.membershipId === currentMembershipId;

                return (
                  <TableRow
                    key={entry.membershipId}
                    sx={
                      isCurrentUser
                        ? { bgcolor: (t) => `${t.palette.primary.main}14` }
                        : undefined
                    }
                  >
                    <TableCell>{entry.displayName}</TableCell>
                    <TableCell>
                      <TeamCell entry={entry} />
                    </TableCell>
                    <TableCell>
                      <ResultCell outcome={entry.outcome} />
                    </TableCell>
                    <TableCell align="right">
                      {entry.pointsEarned == null ? (
                        <Typography variant="body2" color="text.secondary" sx={tabularNums}>
                          —
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            ...tabularNums,
                            color: "primary.main",
                            fontWeight: 700,
                          }}
                        >
                          {entry.pointsEarned}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Stack>
      ))}
    </Stack>
  );
}
