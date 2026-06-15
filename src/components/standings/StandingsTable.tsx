"use client";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { StandingsEntry } from "@/lib/scoring/get-league-standings";

type StandingsTableProps = {
  standings: StandingsEntry[];
  currentMembershipId: string;
};

const tabularNums = { fontVariantNumeric: "tabular-nums" } as const;

function isStandingsEmpty(standings: StandingsEntry[]): boolean {
  return standings.length === 0;
}

function hasNoScoredResults(standings: StandingsEntry[]): boolean {
  return standings.every(
    (s) => s.totalPoints === 0 && s.wins === 0 && s.losses === 0 && s.ties === 0,
  );
}

export function StandingsTable({ standings, currentMembershipId }: StandingsTableProps) {
  if (isStandingsEmpty(standings)) {
    return (
      <Typography variant="body2" color="text.secondary">
        Standings will appear after Week 1 results
      </Typography>
    );
  }

  const hasTies = standings.some((s) => s.ties > 0);
  const noResultsYet = hasNoScoredResults(standings);

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40, ...tabularNums }}>#</TableCell>
            <TableCell sx={{ width: "100%" }}>Participant</TableCell>
            <TableCell sx={tabularNums}>Record</TableCell>
            <TableCell align="right" sx={tabularNums}>
              Pts
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.map((entry) => {
            const isCurrentUser = entry.membershipId === currentMembershipId;
            const record = hasTies
              ? `${entry.wins}-${entry.losses}-${entry.ties}`
              : `${entry.wins}-${entry.losses}`;

            return (
              <TableRow
                key={entry.membershipId}
                sx={
                  isCurrentUser
                    ? { bgcolor: (t) => `${t.palette.primary.main}14` }
                    : undefined
                }
              >
                <TableCell sx={tabularNums}>{entry.rank}</TableCell>
                <TableCell>{entry.displayName}</TableCell>
                <TableCell sx={tabularNums}>{record}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...tabularNums,
                    color: "primary.main",
                    fontWeight: 700,
                  }}
                >
                  {entry.totalPoints}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {noResultsYet && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          No results scored yet
        </Typography>
      )}
    </>
  );
}
