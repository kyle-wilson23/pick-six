"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { getOpponentOfJailedInWeek } from "@/lib/domain/picks";
import {
  getCountdownVariant,
  isPickWindowClosedByDeadline,
} from "@/lib/picks/countdown";
import type {
  CurrentPickJson,
  PicksWeekMatchupJson,
  SeasonPickedTeamJson,
} from "@/lib/picks/picks-week-view-types";

import { MatchupCard, type SelectionEvent } from "./MatchupCard";
import { PickStatusBanner } from "./PickStatusBanner";

type ApiError = { error?: { code?: string; message?: string } };

type LocalSelection = { teamId: string; antiJailedBonus: boolean };

type StatusMessage =
  | { kind: "info"; text: string }
  | { kind: "error"; text: string };

export type WeekMatchupListProps = {
  weekLabel: number;
  /** Numeric NFL week number used in the POST body (`nflWeekNumber`). */
  weekNumber: number;
  leagueId: string;
  matchups: PicksWeekMatchupJson[];
  pickDeadlineUtc?: string | null;
  jailedTeamId?: string | null;
  /** When true, render non-interactive (e.g. preview / off-season). */
  isPreview?: boolean;
  /** Caller's saved current-week pick for initial state + persistent banner. */
  currentPick?: CurrentPickJson | null;
  /** Caller's other-week saved picks for "PICKED WK X" UX. */
  seasonPickedTeams?: SeasonPickedTeamJson[];
};

export function WeekMatchupList({
  weekLabel,
  weekNumber,
  leagueId,
  matchups,
  pickDeadlineUtc = null,
  jailedTeamId = null,
  isPreview = false,
  currentPick = null,
  seasonPickedTeams = [],
}: WeekMatchupListProps) {
  const [selection, setSelection] = useState<LocalSelection | null>(() =>
    currentPick
      ? { teamId: currentPick.teamId, antiJailedBonus: currentPick.antiJailedBonus }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    !isPreview && isPickWindowClosedByDeadline(pickDeadlineUtc, new Date()),
  );

  const radiogroupRef = useRef<HTMLDivElement | null>(null);

  // Keep `isLocked` honest as the page sits open across the deadline. We piggyback on the same
  // tick cadence the countdown uses (1s ≤ 1h, else 30s); a worst-case ~30s lag before lock is fine
  // because the **server** rejects post-deadline POSTs with 403 PICK_DEADLINE_PASSED.
  useEffect(() => {
    if (isPreview || pickDeadlineUtc == null) return;
    const deadlineMs = Date.parse(pickDeadlineUtc);
    if (!Number.isFinite(deadlineMs)) return;

    function check() {
      const remaining = deadlineMs - Date.now();
      const variant = getCountdownVariant(remaining);
      if (variant.urgency === "passed") {
        setIsLocked(true);
      }
    }
    check();
    const remainingNow = deadlineMs - Date.now();
    const intervalMs = remainingNow <= 60 * 60 * 1000 ? 1000 : 30_000;
    const id = window.setInterval(check, intervalMs);
    return () => window.clearInterval(id);
  }, [pickDeadlineUtc, isPreview]);

  const pickedTeamIdsSet = useMemo<ReadonlySet<string>>(
    () => new Set(seasonPickedTeams.map((p) => p.teamId)),
    [seasonPickedTeams],
  );

  const pickedWeekByTeamId = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of seasonPickedTeams) map[p.teamId] = p.weekNumber;
    return map;
  }, [seasonPickedTeams]);

  const antiJailedOpponentTeamId = useMemo<string | null>(() => {
    if (jailedTeamId == null || matchups.length === 0) return null;
    const games = matchups.map((m) => ({ homeTeamId: m.homeTeam.id, awayTeamId: m.awayTeam.id }));
    const opp = getOpponentOfJailedInWeek(jailedTeamId, games);
    return opp.ok ? opp.opponentTeamId : null;
  }, [jailedTeamId, matchups]);

  const teamNameById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const m of matchups) {
      map[m.homeTeam.id] = m.homeTeam.name;
      map[m.awayTeam.id] = m.awayTeam.name;
    }
    return map;
  }, [matchups]);

  const teamAbbrevById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const m of matchups) {
      map[m.homeTeam.id] = m.homeTeam.abbreviation;
      map[m.awayTeam.id] = m.awayTeam.abbreviation;
    }
    return map;
  }, [matchups]);

  const interactive = !isPreview;

  const handleTeamSelect = useCallback(
    async (teamId: string, ev: SelectionEvent) => {
      if (!interactive) return;
      if (ev.kind === "select" && submitting) return;
      if (ev.kind === "blocked") {
        const teamName = teamNameById[teamId] ?? "this team";
        if (ev.reason === "JAILED_TEAM_PICK") {
          setStatusMessage({
            kind: "error",
            text: `${teamName} is the jailed team this week — pick against them for the 2-point bonus or choose another game.`,
          });
        } else if (ev.reason === "DUPLICATE_TEAM") {
          const wk = ev.pickedInWeek;
          setStatusMessage({
            kind: "error",
            text: `You already picked ${teamName}${wk != null ? ` in Week ${wk}` : ""} — each team can be used only once per season.`,
          });
        } else if (ev.reason === "LOCKED") {
          setStatusMessage({
            kind: "error",
            text: "The pick window for this week has closed.",
          });
        }
        return;
      }

      const previous = selection;
      const optimistic: LocalSelection = { teamId, antiJailedBonus: ev.antiJailedBonus };
      setSelection(optimistic);
      setStatusMessage(null);
      setSubmitting(true);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/picks`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, nflWeekNumber: weekNumber, antiJailedBonus: ev.antiJailedBonus }),
        });
        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          const msg =
            data && typeof data === "object" && "error" in data
              ? (data as ApiError).error?.message
              : null;
          setSelection(previous);
          setStatusMessage({ kind: "error", text: msg ?? "Could not save pick. Please try again." });
          return;
        }
        const teamName = teamNameById[teamId] ?? "your team";
        const points = ev.antiJailedBonus ? "2 points" : "1 point";
        setStatusMessage({ kind: "info", text: `Pick saved: ${teamName}, ${points}` });
      } catch {
        setSelection(previous);
        setStatusMessage({ kind: "error", text: "Network error — pick was not saved." });
      } finally {
        setSubmitting(false);
      }
    },
    [interactive, submitting, leagueId, weekNumber, selection, teamNameById],
  );

  // Arrow-key navigation across the radiogroup (skipping disabled cards).
  const handleRadiogroupKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowRight" && e.key !== "ArrowLeft") {
      return;
    }
    const root = radiogroupRef.current;
    if (!root) return;
    const radios = Array.from(
      root.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'),
    );
    if (radios.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? radios.indexOf(active) : -1;
    e.preventDefault();
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + dir + radios.length) % radios.length;
    radios[nextIndex]?.focus();
  }, [interactive]);

  const bannerTeamName =
    selection != null ? teamNameById[selection.teamId] ?? null : null;
  const bannerTeamAbbrev =
    selection != null ? teamAbbrevById[selection.teamId] ?? null : null;

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Typography variant="h6" component="h2">
        Week {weekLabel} Matchups
      </Typography>

      {!isPreview ? (
        <PickStatusBanner
          teamName={bannerTeamName}
          teamAbbreviation={bannerTeamAbbrev}
          antiJailedBonus={selection?.antiJailedBonus ?? false}
          isLocked={isLocked}
          weekNumber={weekLabel}
        />
      ) : null}

      {!isPreview && statusMessage ? (
        <Stack
          role={statusMessage.kind === "error" ? "alert" : "status"}
          aria-live={statusMessage.kind === "error" ? "assertive" : "polite"}
          sx={{
            px: 1.25,
            py: 1,
            borderRadius: 2,
            bgcolor: (t) =>
              statusMessage.kind === "error" ? `${t.palette.error.main}1A` : `${t.palette.success.main}1A`,
            border: (t) => `1px solid ${
              statusMessage.kind === "error" ? t.palette.error.main : t.palette.success.main
            }33`,
          }}
        >
          <Typography
            variant="body2"
            color={statusMessage.kind === "error" ? "error.main" : "success.main"}
          >
            {statusMessage.text}
          </Typography>
        </Stack>
      ) : null}

      {matchups.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No games are scheduled or loaded for this week yet.
        </Typography>
      ) : (
        <Box
          ref={radiogroupRef}
          role={interactive ? "radiogroup" : undefined}
          aria-label={interactive ? `Pick a team for Week ${weekLabel}` : undefined}
          aria-busy={submitting || undefined}
          onKeyDown={interactive ? handleRadiogroupKeyDown : undefined}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          {matchups.map((m) => (
            <MatchupCard
              key={m.gameId}
              matchup={m}
              jailedTeamId={jailedTeamId}
              onTeamSelect={interactive ? handleTeamSelect : undefined}
              selectedTeamId={selection?.teamId ?? null}
              pickedTeamIds={pickedTeamIdsSet}
              pickedWeekByTeamId={pickedWeekByTeamId}
              isLocked={isLocked}
              antiJailedOpponentTeamId={antiJailedOpponentTeamId}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
}
