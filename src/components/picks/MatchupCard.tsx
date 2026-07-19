"use client";

import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useMemo, type KeyboardEvent } from "react";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import {
  computeMatchupSideState,
  type MatchupSideState,
} from "@/lib/picks/matchup-card-state";
import { buildTeamPickAriaLabel } from "@/lib/picks/team-pick-aria-label";
import { focusVisibleRingSx } from "@/theme/focus-visible-ring";

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

export type SelectionReason =
  | "JAILED_TEAM_PICK"
  | "DUPLICATE_TEAM"
  | "LOCKED";

export type SelectionEvent =
  | { kind: "select"; antiJailedBonus: boolean }
  | { kind: "blocked"; reason: SelectionReason; pickedInWeek?: number };

export type MatchupCardProps = {
  matchup: PicksWeekMatchupJson;
  /** Story 3.7 — when present, each clickable side gets `role="radio"` and keyboard support. */
  onTeamSelect?: (teamId: string, event: SelectionEvent) => void;
  selectedTeamId?: string | null;
  jailedTeamId?: string | null;
  /** Set of team ids the participant picked in **other** weeks. */
  pickedTeamIds?: ReadonlySet<string>;
  /** `teamId → otherWeekNumber` for "PICKED WK X" overlay. */
  pickedWeekByTeamId?: Record<string, number>;
  /** When true, the active-week deadline has passed → no `select` events fire. */
  isLocked?: boolean;
  /** Anti-jailed eligible opponent (precomputed by the controller). */
  antiJailedOpponentTeamId?: string | null;
  /** True while a pick POST is in flight — selected card shows pending cue. */
  isSubmitting?: boolean;
};

export function MatchupCard(props: MatchupCardProps) {
  const {
    matchup,
    onTeamSelect,
    selectedTeamId = null,
    jailedTeamId = null,
    pickedTeamIds,
    pickedWeekByTeamId,
    isLocked = false,
    antiJailedOpponentTeamId = null,
    isSubmitting = false,
  } = props;
  const { homeTeam, awayTeam } = matchup;
  const weather = matchup.weather;
  const stadiumRoof = matchup.stadiumRoof;
  const homeSpreadPts = matchup.homeSpreadPoints;

  const homeSpreadStr = homeSpreadPts !== null ? fmtSpread.format(homeSpreadPts) : null;
  const awaySpreadStr =
    homeSpreadPts !== null ? fmtSpread.format(homeSpreadPts === 0 ? 0 : -homeSpreadPts) : null;

  const interactive = typeof onTeamSelect === "function";

  const pickedTeamIdsSet = useMemo<ReadonlySet<string>>(
    () => pickedTeamIds ?? new Set<string>(),
    [pickedTeamIds],
  );

  const homeState = computeMatchupSideState({
    teamId: homeTeam.id,
    jailedTeamId,
    pickedTeamIds: pickedTeamIdsSet,
    selectedTeamId,
    isLocked,
  });
  const awayState = computeMatchupSideState({
    teamId: awayTeam.id,
    jailedTeamId,
    pickedTeamIds: pickedTeamIdsSet,
    selectedTeamId,
    isLocked,
  });

  const cardHasSelected = homeState === "selected" || awayState === "selected";
  const cardHasJailed = homeState === "jailed" || awayState === "jailed";
  const showPending = isSubmitting && cardHasSelected;

  let kickDisplay = "—";
  try {
    const parsed = parseISO(matchup.kickoffAt);
    if (!Number.isNaN(parsed.getTime())) {
      kickDisplay = formatInTimeZone(parsed, LEAGUE_BUSINESS_TIMEZONE, "EEE h:mm a 'ET'");
    }
  } catch {
    kickDisplay = "—";
  }

  function handleTeamActivate(
    teamId: string,
    state: MatchupSideState,
    opts: { antiJailedBonus: boolean } = { antiJailedBonus: false },
  ) {
    if (!interactive || isSubmitting) return;
    if (state === "jailed") {
      onTeamSelect?.(teamId, { kind: "blocked", reason: "JAILED_TEAM_PICK" });
      return;
    }
    if (state === "alreadyPicked") {
      const pickedInWeek = pickedWeekByTeamId?.[teamId];
      onTeamSelect?.(teamId, {
        kind: "blocked",
        reason: "DUPLICATE_TEAM",
        pickedInWeek,
      });
      return;
    }
    if (state === "locked") {
      onTeamSelect?.(teamId, { kind: "blocked", reason: "LOCKED" });
      return;
    }
    onTeamSelect?.(teamId, { kind: "select", antiJailedBonus: opts.antiJailedBonus });
  }

  function renderTeamSide(args: {
    team: { id: string; abbreviation: string; name: string };
    state: MatchupSideState;
    moneylineAmerican: number | null;
    spreadStr: string | null;
  }) {
    const { team, state, moneylineAmerican, spreadStr } = args;
    const isSelected = state === "selected";
    const isJailed = state === "jailed";
    const isAlreadyPicked = state === "alreadyPicked";
    const isDisabled = isJailed || isAlreadyPicked || isLocked || isSubmitting;
    const isAntiJailedEligible =
      !isLocked && !isJailed && !isAlreadyPicked && !isSubmitting &&
      antiJailedOpponentTeamId != null && team.id === antiJailedOpponentTeamId;

    const otherWeek = isAlreadyPicked ? pickedWeekByTeamId?.[team.id] : undefined;

    const ariaLabel = buildTeamPickAriaLabel({
      teamName: team.name,
      moneylineLabel: formatAmericanMl(moneylineAmerican),
      state,
      pickedInWeek: otherWeek,
    });

    const role = interactive ? "radio" : undefined;
    const tabIndex = interactive ? (isDisabled ? -1 : 0) : undefined;
    const ariaChecked = interactive ? isSelected : undefined;
    const ariaDisabled = interactive ? isDisabled : undefined;

    function onClick() {
      handleTeamActivate(team.id, state);
    }
    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      if (!interactive) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleTeamActivate(team.id, state);
      }
    }

    return (
      <Stack
        spacing={0.75}
        alignItems="flex-start"
        role={role}
        tabIndex={tabIndex}
        aria-checked={ariaChecked}
        aria-disabled={ariaDisabled}
        aria-label={ariaLabel}
        onClick={interactive ? onClick : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          py: 0.5,
          pl: 0.5,
          borderRadius: 1,
          cursor: interactive && !isDisabled ? "pointer" : "default",
          color: isAlreadyPicked ? "text.disabled" : "inherit",
          outline: "none",
          "&:focus-visible": focusVisibleRingSx,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TeamLogo
            abbreviation={team.abbreviation}
            teamName={team.name}
            size="lg"
            jailed={isJailed}
            disabled={isAlreadyPicked}
            pickedWeekTag={otherWeek}
          />
          <Typography
            variant="subtitle1"
            component="span"
            fontWeight={600}
            sx={{ color: isAlreadyPicked || isJailed ? "text.disabled" : "inherit" }}
          >
            {team.name}
          </Typography>
        </Stack>
        <Typography variant="body2" fontWeight={500} sx={{ ml: 5 }}>
          ML {formatAmericanMl(moneylineAmerican)}
          {spreadStr ? ` · ${spreadStr}` : ""}
        </Typography>
        {isAntiJailedEligible ? (
          <Chip
            size="small"
            label="2 PTS"
            onClick={interactive ? (e) => {
              e.stopPropagation();
              handleTeamActivate(team.id, state, { antiJailedBonus: true });
            } : undefined}
            onKeyDown={interactive ? (e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleTeamActivate(team.id, state, { antiJailedBonus: true });
              }
            } : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={`Pick ${team.name} for 2-point anti-jailed bonus`}
            sx={{
              ml: 5,
              minWidth: 44,
              minHeight: 44,
              fontWeight: 700,
              letterSpacing: 0.5,
              bgcolor: (t) => t.palette.accent.gold,
              color: (t) => t.palette.getContrastText(t.palette.accent.gold),
              "&:hover": {
                bgcolor: (t) => t.palette.accent.goldDark,
              },
              cursor: interactive ? "pointer" : "default",
            }}
          />
        ) : null}
      </Stack>
    );
  }

  return (
    <Card
      variant="outlined"
      aria-busy={showPending || undefined}
      sx={{
        width: "100%",
        maxWidth: { xs: 560, md: "none" },
        px: { xs: 1.25, sm: 2 },
        py: { xs: 1.25, sm: 1.5 },
        bgcolor: cardHasSelected ? "background.elevated" : "background.paper",
        borderWidth: cardHasJailed ? 2 : cardHasSelected ? 2 : 1,
        borderStyle: "solid",
        borderColor: cardHasJailed
          ? "warning.main"
          : cardHasSelected
            ? "primary.main"
            : "divider",
        opacity: isSubmitting && !cardHasSelected ? 0.55 : showPending ? 0.9 : 1,
        pointerEvents: isSubmitting ? "none" : "auto",
        transition: (t) =>
          t.transitions.create(["background-color", "border-color", "opacity"], {
            duration: t.transitions.duration.shortest,
          }),
        "&:hover": interactive && !isSubmitting
          ? { bgcolor: "background.elevated" }
          : undefined,
      }}
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" component="p">
              {kickDisplay}
            </Typography>
            {showPending ? (
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <CircularProgress size={16} thickness={5} aria-label="Saving pick" />
                <Typography variant="caption" color="primary.main" fontWeight={600}>
                  Saving…
                </Typography>
              </Stack>
            ) : null}
          </Stack>
          {weather ? (
            stadiumRoof === "retractable" ? (
              <Tooltip title="Retractable roof — may be open or closed on game day">
                <Chip
                  size="small"
                  variant="outlined"
                  color="info"
                  label={`${weather.tempF}°F · ${weather.condition} · ${weather.windMph} mph wind`}
                  sx={{ maxWidth: "100%", cursor: "default" }}
                />
              </Tooltip>
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label={`${weather.tempF}°F · ${weather.condition} · ${weather.windMph} mph wind`}
                sx={{ maxWidth: "100%" }}
              />
            )
          ) : stadiumRoof === "dome" ? (
            <Chip
              size="small"
              variant="outlined"
              label="Indoor"
              sx={{ maxWidth: "100%" }}
            />
          ) : stadiumRoof === "retractable" ? (
            <Tooltip title="Retractable roof — may be open or closed on game day">
              <Chip
                size="small"
                variant="outlined"
                color="info"
                label="Retractable Roof"
                sx={{ maxWidth: "100%", cursor: "default" }}
              />
            </Tooltip>
          ) : null}
        </Stack>

        <Divider flexItem sx={{ mt: -0.5 }} />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          justifyContent="space-between"
        >
          {renderTeamSide({
            team: awayTeam,
            state: awayState,
            moneylineAmerican: matchup.awayMoneylineAmerican,
            spreadStr: awaySpreadStr,
          })}

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

          {renderTeamSide({
            team: homeTeam,
            state: homeState,
            moneylineAmerican: matchup.homeMoneylineAmerican,
            spreadStr: homeSpreadStr,
          })}
        </Stack>

        <Typography variant="body2" color="text.secondary" component="p">
          Spread · Home {homeSpreadStr ?? "–"} · Away {awaySpreadStr ?? "–"} (home perspective)
        </Typography>
      </Stack>
    </Card>
  );
}
