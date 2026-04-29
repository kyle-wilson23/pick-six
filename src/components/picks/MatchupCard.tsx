"use client";

import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { MouseEventHandler } from "react";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";

import type { PicksWeekMatchupJson } from "@/lib/picks/picks-week-view-types";

import { TeamLogo } from "./TeamLogo";

const fmtSpread = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  signDisplay: "always",
});

function formatAmericanMl(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}

export type MatchupCardProps = {
  matchup: PicksWeekMatchupJson;
  onTeamSelect?: (teamId: string) => void;
  selectedTeamId?: string | null;
  jailedTeamId?: string | null;
  pickedTeamIds?: string[];
};

export function MatchupCard(props: MatchupCardProps) {
  const { matchup, onTeamSelect } = props;
  const { homeTeam, awayTeam } = matchup;
  const weather = matchup.weather;
  const homeSpreadPts = matchup.homeSpreadPoints;

  const homeSpreadStr =
    homeSpreadPts !== null ? fmtSpread.format(homeSpreadPts) : null;
  const awaySpreadStr =
    homeSpreadPts !== null ? fmtSpread.format(homeSpreadPts === 0 ? 0 : -homeSpreadPts) : null;

  const clickable = typeof onTeamSelect === "function";

  const mkTeamHandlers = (teamId: string): { onClick?: MouseEventHandler } =>
    clickable
      ? {
          onClick: () => {
            onTeamSelect?.(teamId);
          },
        }
      : {};

  let kickDisplay = "—";
  try {
    const parsed = parseISO(matchup.kickoffAt);
    if (!Number.isNaN(parsed.getTime())) {
      kickDisplay = formatInTimeZone(parsed, LEAGUE_BUSINESS_TIMEZONE, "EEE h:mm a 'ET'");
    }
  } catch {
    kickDisplay = "—";
  }

  return (
    <Card
      variant="outlined"
      sx={{ width: "100%", maxWidth: 560, px: { xs: 1.25, sm: 2 }, py: { xs: 1.25, sm: 1.5 } }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="body2" color="text.secondary" component="p">
            {kickDisplay}
          </Typography>
          {weather ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${weather.tempF}°F · ${weather.condition} · ${weather.windMph} mph wind`}
              sx={{ maxWidth: "100%" }}
            />
          ) : null}
        </Stack>

        <Divider flexItem sx={{ mt: -0.5 }} />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          justifyContent="space-between"
        >
          <Stack
            {...mkTeamHandlers(awayTeam.id)}
            spacing={0.75}
            alignItems="flex-start"
            sx={{
              flex: 1,
              minWidth: 0,
              cursor: clickable ? "pointer" : "default",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TeamLogo
                abbreviation={awayTeam.abbreviation}
                teamName={awayTeam.name}
                size="md"
              />
              <Typography variant="subtitle1" component="span" fontWeight={600}>
                {awayTeam.name}
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ ml: 5 }}>
              ML {formatAmericanMl(matchup.awayMoneylineAmerican)}
            </Typography>
          </Stack>

          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              alignSelf: { xs: "center", sm: "flex-start" },
              pt: { sm: 1 },
            }}
          >
            @
          </Typography>

          <Stack
            {...mkTeamHandlers(homeTeam.id)}
            spacing={0.75}
            alignItems="flex-start"
            sx={{
              flex: 1,
              minWidth: 0,
              cursor: clickable ? "pointer" : "default",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <TeamLogo
                abbreviation={homeTeam.abbreviation}
                teamName={homeTeam.name}
                size="md"
              />
              <Typography variant="subtitle1" component="span" fontWeight={600}>
                {homeTeam.name}
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ ml: 5 }}>
              ML {formatAmericanMl(matchup.homeMoneylineAmerican)}
            </Typography>
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" component="p">
          Spread · Home {homeSpreadStr ?? "–"} · Away {awaySpreadStr ?? "–"} (home perspective)
        </Typography>
      </Stack>
    </Card>
  );
}
