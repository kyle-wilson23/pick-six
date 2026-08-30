"use client";

import CheckCircle from "@mui/icons-material/CheckCircle";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { TeamLogo } from "@/components/picks/TeamLogo";
import { UserIdentityCell } from "@/components/user/UserIdentityCell";
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

const ellipsisCellSx = {
  maxWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

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
        flexShrink: 0,
        bgcolor: (t) => t.palette.accent.gold,
        color: (t) => t.palette.getContrastText(t.palette.accent.gold),
        "&:hover": {
          bgcolor: (t) => t.palette.accent.goldDark,
        },
      }}
    />
  );
}

type RevealedTeamEntry = PeerPickEntry & {
  teamAbbreviation: string;
  teamName: string;
};

function hasTeamIdentity(entry: PeerPickEntry): entry is RevealedTeamEntry {
  return (
    entry.teamAbbreviation != null &&
    entry.teamName != null &&
    entry.teamAbbreviation !== "" &&
    entry.teamName !== ""
  );
}

function teamCellTitle(entry: PeerPickEntry): string | undefined {
  if (!hasTeamIdentity(entry)) return undefined;
  const { teamAbbreviation, teamName } = entry;
  if (teamAbbreviation !== teamName) {
    return `${teamAbbreviation} ${teamName}`;
  }
  return teamName;
}

function TeamCell({ entry }: { entry: PeerPickEntry }) {
  if (!hasTeamIdentity(entry)) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <CheckCircle aria-label="Pick submitted" color="success" fontSize="small" />
        <Typography variant="body2" color="text.secondary" noWrap>
          Submitted
        </Typography>
      </Stack>
    );
  }

  const { teamAbbreviation, teamName } = entry;

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <TeamLogo
        abbreviation={teamAbbreviation}
        teamName={teamName}
        size="sm"
      />
      <Stack spacing={0.25} alignItems="flex-start" sx={{ minWidth: 0, overflow: "hidden" }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, maxWidth: "100%" }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {entry.teamAbbreviation}
          </Typography>
          {entry.antiJailedBonus ? <AntiJailedChip /> : null}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {entry.teamName}
        </Typography>
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

          <TableContainer sx={{ width: "100%", overflowX: "hidden" }}>
            <Table
              size="small"
              aria-label={`League results week ${week.weekNumber}`}
              sx={{ tableLayout: "fixed", width: "100%" }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Participant</TableCell>
                  <TableCell sx={{ width: "38%" }}>Team</TableCell>
                  <TableCell sx={{ width: 96, minWidth: 96, px: 1, whiteSpace: "nowrap" }}>
                    Result
                  </TableCell>
                  <TableCell align="right" sx={{ width: 44, minWidth: 44, px: 1, ...tabularNums }}>
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
                      <TableCell title={entry.displayName} sx={ellipsisCellSx}>
                        <UserIdentityCell
                          displayName={entry.displayName}
                          imageUrl={entry.imageUrl}
                        />
                      </TableCell>
                      <TableCell title={teamCellTitle(entry)} sx={ellipsisCellSx}>
                        <TeamCell entry={entry} />
                      </TableCell>
                      <TableCell sx={{ width: 96, minWidth: 96, px: 1, whiteSpace: "nowrap" }}>
                        <ResultCell outcome={entry.outcome} />
                      </TableCell>
                      <TableCell align="right" sx={{ width: 44, minWidth: 44, px: 1 }}>
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
          </TableContainer>
        </Stack>
      ))}
    </Stack>
  );
}
