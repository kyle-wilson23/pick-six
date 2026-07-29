"use client";

import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { TestLeagueChip } from "@/components/league/TestLeagueChip";
import type { AdministeredLeagueWithSeasonRow } from "@/lib/league/list-administered-leagues";
import type { JoinedLeagueWithCurrentSeasonRow } from "@/lib/league/list-joined-leagues";
import { describeSeasonForParticipant } from "@/lib/league/describe-season-for-participant";

const HOME_LIST_LIMIT = 3;

type HomeJoinedLeaguesCardProps = {
  rows: JoinedLeagueWithCurrentSeasonRow[];
  nflSeasonYear: number;
};

export function HomeJoinedLeaguesCard({ rows, nflSeasonYear }: HomeJoinedLeaguesCardProps) {
  const preview = rows.slice(0, HOME_LIST_LIMIT);
  const hasMore = rows.length > HOME_LIST_LIMIT;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" component="h2">
            Your leagues
          </Typography>

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              You are not in any leagues yet. Ask an admin for an invite, or create a league.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {preview.map((row) => (
                <Paper key={row.league.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle1" component="h3">
                        <Link href={`/leagues/${row.league.id}`}>{row.league.name}</Link>
                      </Typography>
                      {row.league.isTestLeague ? <TestLeagueChip /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Role: {row.role}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {describeSeasonForParticipant({ nflSeasonYear, season: row.season })}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
              {hasMore ? (
                <Button
                  variant="text"
                  color="primary"
                  component={Link}
                  href="/my-leagues"
                  sx={{ alignSelf: "flex-start", minHeight: 44 }}
                >
                  Show more
                </Button>
              ) : null}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

type HomeAdminLeaguesCardProps = {
  rows: AdministeredLeagueWithSeasonRow[];
  nflSeasonYear: number;
};

export function HomeAdminLeaguesCard({ rows, nflSeasonYear }: HomeAdminLeaguesCardProps) {
  const preview = rows.slice(0, HOME_LIST_LIMIT);
  const hasMore = rows.length > HOME_LIST_LIMIT;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" component="h2">
            Leagues you administer
          </Typography>

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              You are not an admin of any league yet.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {preview.map((row) => (
                <Paper key={row.league.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle1" component="h3">
                        <Link href={`/leagues/${row.league.id}`}>{row.league.name}</Link>
                      </Typography>
                      {row.league.isTestLeague ? <TestLeagueChip /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {row.season
                        ? `Current season: ${row.season.nflSeasonYear} · First competition week ${row.season.firstCompetitionWeek}${
                            row.season.preSeasonInitializedAt
                              ? " · Pre-season initialized"
                              : " · Pre-season not initialized"
                          }`
                        : `No season row for NFL ${nflSeasonYear} yet.`}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
              {hasMore ? (
                <Button
                  variant="text"
                  color="primary"
                  component={Link}
                  href="/leagues"
                  sx={{ alignSelf: "flex-start", minHeight: 44 }}
                >
                  Show more
                </Button>
              ) : null}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
