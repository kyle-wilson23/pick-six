"use client";

import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { TeamLogo } from "@/components/picks/TeamLogo";
import { UserIdentityCell } from "@/components/user/UserIdentityCell";
import type { LeagueWeekPeerPickRow } from "@/lib/picks/get-league-week-peer-picks";

type OpponentsPicksTableProps = {
  rows: LeagueWeekPeerPickRow[];
};

function PickCell({ team }: { team: LeagueWeekPeerPickRow["team"] }) {
  if (team == null) {
    return (
      <Typography variant="body2" color="text.secondary">
        --
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <TeamLogo abbreviation={team.abbreviation} teamName={team.name} size="sm" />
      <Typography variant="body2" fontWeight={600} noWrap>
        {team.abbreviation}
      </Typography>
    </Stack>
  );
}

export function OpponentsPicksTable({ rows }: OpponentsPicksTableProps) {
  return (
    <Table size="small" aria-label="Opponents' picks">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: "100%" }}>Name</TableCell>
          <TableCell>Pick</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.membershipId}>
            <TableCell>
              <UserIdentityCell
                displayName={row.displayName}
                imageUrl={row.imageUrl}
              />
            </TableCell>
            <TableCell>
              <PickCell team={row.team} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
