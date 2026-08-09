"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
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
import {
  isPickDraftDirty,
  type PickSelection,
} from "@/lib/picks/pick-draft-dirty";
import type {
  CurrentPickJson,
  PicksWeekMatchupJson,
  SeasonPickedTeamJson,
} from "@/lib/picks/picks-week-view-types";

import { MatchupCard, type SelectionEvent } from "./MatchupCard";
import { PickStatusBanner } from "./PickStatusBanner";

type ApiError = { error?: { code?: string; message?: string } };

type StatusMessage =
  | { kind: "info"; text: string }
  | { kind: "error"; text: string };

function toSelection(pick: CurrentPickJson | null): PickSelection | null {
  return pick
    ? { teamId: pick.teamId, antiJailedBonus: pick.antiJailedBonus }
    : null;
}

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
  const initial = toSelection(currentPick);
  const [draft, setDraft] = useState<PickSelection | null>(() => initial);
  const [saved, setSaved] = useState<PickSelection | null>(() => initial);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    !isPreview && isPickWindowClosedByDeadline(pickDeadlineUtc, new Date()),
  );

  const radiogroupRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);

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
  const dirty = isPickDraftDirty(draft, saved);
  // Visible only with a pending (dirty) selection — no disabled placeholder FAB.
  const showSubmitButton = interactive && !isLocked && dirty;

  const handleTeamSelect = useCallback(
    (teamId: string, ev: SelectionEvent) => {
      if (!interactive || isLocked) return;
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

      setDraft({ teamId, antiJailedBonus: ev.antiJailedBonus });
      setStatusMessage(null);
    },
    [interactive, isLocked, submitting, teamNameById],
  );

  const handleSubmitPick = useCallback(async () => {
    if (!interactive || isLocked || submitting || !dirty || draft == null) return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: draft.teamId,
          nflWeekNumber: weekNumber,
          antiJailedBonus: draft.antiJailedBonus,
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const msg =
          data && typeof data === "object" && "error" in data
            ? (data as ApiError).error?.message
            : null;
        setStatusMessage({ kind: "error", text: msg ?? "Could not save pick. Please try again." });
        return;
      }
      setSaved(draft);
      const teamName = teamNameById[draft.teamId] ?? "your team";
      const points = draft.antiJailedBonus ? "2 points" : "1 point";
      setStatusMessage({ kind: "info", text: `Pick saved: ${teamName}, ${points}` });
    } catch {
      setStatusMessage({ kind: "error", text: "Network error — pick was not saved." });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [
    interactive,
    isLocked,
    submitting,
    dirty,
    draft,
    leagueId,
    weekNumber,
    teamNameById,
  ]);

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
    saved != null ? teamNameById[saved.teamId] ?? null : null;
  const bannerTeamAbbrev =
    saved != null ? teamAbbrevById[saved.teamId] ?? null : null;

  const draftTeamName =
    draft != null ? teamNameById[draft.teamId] ?? "team" : null;
  const submitLabel =
    draftTeamName != null ? `Submit Pick: ${draftTeamName}` : "Submit Pick";

  return (
    <Stack
      spacing={2}
      sx={{
        width: "100%",
        // Clear the fixed submit control so the last matchup rows stay reachable.
        pb: showSubmitButton
          ? { xs: "calc(56px + env(safe-area-inset-bottom, 0px) + 72px)", md: 10 }
          : 0,
      }}
    >
      <Typography variant="h6" component="h2">
        Week {weekLabel} Matchups
      </Typography>

      {!isPreview ? (
        <PickStatusBanner
          teamName={bannerTeamName}
          teamAbbreviation={bannerTeamAbbrev}
          antiJailedBonus={saved?.antiJailedBonus ?? false}
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
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {matchups.map((m) => (
            <MatchupCard
              key={m.gameId}
              matchup={m}
              jailedTeamId={jailedTeamId}
              onTeamSelect={interactive ? handleTeamSelect : undefined}
              selectedTeamId={draft?.teamId ?? null}
              pickedTeamIds={pickedTeamIdsSet}
              pickedWeekByTeamId={pickedWeekByTeamId}
              isLocked={isLocked}
              antiJailedOpponentTeamId={antiJailedOpponentTeamId}
              isSubmitting={submitting}
            />
          ))}
        </Box>
      )}

      {showSubmitButton ? (
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={submitting}
          onClick={() => {
            void handleSubmitPick();
          }}
          startIcon={
            submitting ? (
              <CircularProgress size={16} thickness={5} color="inherit" aria-hidden />
            ) : undefined
          }
          aria-busy={submitting || undefined}
          sx={{
            position: "fixed",
            right: 16,
            bottom: {
              xs: "calc(56px + env(safe-area-inset-bottom, 0px) + 16px)",
              md: 24,
            },
            zIndex: (t) => t.zIndex.tooltip,
            boxShadow: 4,
          }}
        >
          {submitLabel}
        </Button>
      ) : null}
    </Stack>
  );
}
