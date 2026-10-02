"use client";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { UserIdentityCell } from "@/components/user/UserIdentityCell";
import type { StandingsEntry } from "@/lib/scoring/get-league-standings";
import { formatWinLossRecord } from "@/lib/scoring/format-win-loss-record";

type StandingsTableVariant = "points" | "biggest-loser";

type StandingsTableProps = {
  standings: StandingsEntry[];
  currentMembershipId: string;
  variant?: StandingsTableVariant;
};

const tabularNums = { fontVariantNumeric: "tabular-nums" } as const;

/** Phones stack the header; sm+ keeps one line. Narrower column frees name space. */
const validLossesColumnSx = {
  width: { xs: 56, sm: 132 },
  px: { xs: 0.5, sm: 2 },
  ...tabularNums,
} as const;

const biggestLoserHeaderAlignSx = {
  verticalAlign: { xs: "bottom", sm: "middle" },
} as const;

const validLossesHeaderSx = {
  ...validLossesColumnSx,
  whiteSpace: { xs: "normal", sm: "nowrap" },
  lineHeight: 1.15,
  verticalAlign: { xs: "bottom", sm: "middle" },
} as const;

const stackedHeaderWordSx = { display: { xs: "block", sm: "inline" } } as const;

function ValidLossesHeading() {
  return (
    <>
      <Box component="span" sx={stackedHeaderWordSx}>
        Valid
      </Box>
      <Box component="span" sx={stackedHeaderWordSx}>
        {" losses"}
      </Box>
    </>
  );
}

function isStandingsEmpty(standings: StandingsEntry[]): boolean {
  return standings.length === 0;
}

function hasNoScoredResults(standings: StandingsEntry[]): boolean {
  return standings.every(
    (s) =>
      s.totalPoints === 0 &&
      s.wins === 0 &&
      s.losses === 0 &&
      s.ties === 0 &&
      s.missedWeeks === 0,
  );
}

export function StandingsTable({
  standings,
  currentMembershipId,
  variant = "points",
}: StandingsTableProps) {
  if (isStandingsEmpty(standings)) {
    return (
      <Typography variant="body2" color="text.secondary">
        Standings will appear after Week 1 results
      </Typography>
    );
  }

  const isBiggestLoser = variant === "biggest-loser";
  const hasTies = standings.some((s) => s.ties > 0);
  const noResultsYet = hasNoScoredResults(standings);

  return (
    <>
      <TableContainer sx={{ width: "100%", overflowX: "hidden" }}>
        <Table
          size="small"
          aria-label={isBiggestLoser ? "Biggest loser" : "League standings"}
          sx={{ tableLayout: "fixed", width: "100%" }}
        >
          {isBiggestLoser ? (
            <colgroup>
              <col style={{ width: 40 }} />
              <col />
              <col style={{ width: 72 }} />
              <Box component="col" sx={{ width: { xs: 56, sm: 132 } }} />
            </colgroup>
          ) : null}
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  width: isBiggestLoser ? 40 : 36,
                  px: isBiggestLoser ? 1 : undefined,
                  ...tabularNums,
                  ...(isBiggestLoser ? biggestLoserHeaderAlignSx : {}),
                }}
              >
                #
              </TableCell>
              <TableCell
                sx={
                  isBiggestLoser
                    ? { width: "100%", ...biggestLoserHeaderAlignSx }
                    : undefined
                }
              >
                Participant
              </TableCell>
              <TableCell
                sx={{
                  width: 72,
                  px: isBiggestLoser ? 1 : undefined,
                  whiteSpace: "nowrap",
                  ...tabularNums,
                  ...(isBiggestLoser ? biggestLoserHeaderAlignSx : {}),
                }}
              >
                Record
              </TableCell>
              <TableCell
                align="right"
                sx={isBiggestLoser ? validLossesHeaderSx : { width: 44, ...tabularNums }}
              >
                {isBiggestLoser ? <ValidLossesHeading /> : "Pts"}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {standings.map((entry) => {
              const isCurrentUser = entry.membershipId === currentMembershipId;
              const record = formatWinLossRecord(
                {
                  wins: entry.wins,
                  validLosses: entry.losses,
                  ties: entry.ties,
                  missedWeeks: entry.missedWeeks,
                },
                { includeTies: hasTies },
              );

              return (
                <TableRow
                  key={entry.membershipId}
                  aria-current={isCurrentUser ? true : undefined}
                  sx={
                    isCurrentUser
                      ? { bgcolor: (t) => `${t.palette.primary.main}14` }
                      : undefined
                  }
                >
                  <TableCell sx={{ ...tabularNums, ...(isBiggestLoser ? { px: 1 } : {}) }}>
                    {entry.rank}
                  </TableCell>
                  <TableCell
                    title={entry.displayName}
                    sx={{
                      width: isBiggestLoser ? "100%" : undefined,
                      maxWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <UserIdentityCell
                      displayName={entry.displayName}
                      imageUrl={entry.imageUrl}
                    />
                    {isCurrentUser ? (
                      <Typography
                        component="span"
                        sx={{
                          position: "absolute",
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: "hidden",
                          clip: "rect(0, 0, 0, 0)",
                          whiteSpace: "nowrap",
                          border: 0,
                        }}
                      >
                        {" "}
                        (You)
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell
                    sx={{
                      whiteSpace: "nowrap",
                      ...tabularNums,
                      ...(isBiggestLoser ? { px: 1 } : {}),
                    }}
                  >
                    {record}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...(isBiggestLoser ? validLossesColumnSx : tabularNums),
                      color: isBiggestLoser ? "error.main" : "primary.main",
                      fontWeight: 700,
                    }}
                  >
                    {isBiggestLoser ? entry.losses : entry.totalPoints}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {!isBiggestLoser && noResultsYet && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          No results scored yet
        </Typography>
      )}
    </>
  );
}
