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
  PersonalPickHistory,
  PickHistoryEntry,
  PickHistoryOutcome,
} from "@/lib/scoring/get-personal-pick-history";

type PickHistoryTableProps = {
  history: PersonalPickHistory;
};

const tabularNums = { fontVariantNumeric: "tabular-nums" } as const;

const resultMeta = {
  WIN: { label: "WIN", key: "success" as const },
  LOSS: { label: "LOSS", key: "error" as const },
} as const;

function formatRecord(history: PersonalPickHistory): string {
  return history.ties > 0
    ? `${history.wins}-${history.losses}-${history.ties}`
    : `${history.wins}-${history.losses}`;
}

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

  const meta = resultMeta[outcome];
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
      }}
    />
  );
}

function TeamCell({ entry }: { entry: PickHistoryEntry }) {
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

export function PickHistoryTable({ history }: PickHistoryTableProps) {
  if (history.entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Your pick history will appear here after your first submission
      </Typography>
    );
  }

  const record = formatRecord(history);

  return (
    <Stack spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={tabularNums}>
        {record} · {history.totalPoints} pts
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40, ...tabularNums }}>Wk</TableCell>
            <TableCell sx={{ width: "100%" }}>Team</TableCell>
            <TableCell>Result</TableCell>
            <TableCell align="right" sx={tabularNums}>
              Pts
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {history.entries.map((entry) => (
            <TableRow key={entry.nflWeekNumber}>
              <TableCell sx={tabularNums}>{entry.nflWeekNumber}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
