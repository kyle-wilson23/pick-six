"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import { summarizeFinalizeWeekResult } from "@/lib/admin/summarize-finalize-week";
import { normalizeMoneylineToDecimal } from "@/lib/domain/odds-format";

function moneylineDraftValue(n: number | null): string {
  if (n === null) {
    return "";
  }
  const dec = normalizeMoneylineToDecimal(n);
  return dec === null ? "" : dec.toFixed(3);
}

type ApiErr = { error?: { code?: string; message?: string } };

type GameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL" | "CANCELLED";

type GameRow = {
  id: string;
  kickoffAt: string;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeAbbreviation: string;
  awayAbbreviation: string;
  homeMoneylineAmerican: number | null;
  awayMoneylineAmerican: number | null;
  homeSpreadPoints: string | null;
};

type NflOddsAdminPanelProps = {
  defaultNflSeasonYear: number;
  firstCompetitionWeek: number | null;
};

function parseNullableFloat(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseScore(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || !/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

function isGameResolvedForScoring(status: GameStatus): boolean {
  return status === "FINAL" || status === "CANCELLED";
}

export function NflOddsAdminPanel({ defaultNflSeasonYear, firstCompetitionWeek }: NflOddsAdminPanelProps) {
  const [year, setYear] = useState(String(defaultNflSeasonYear));
  const [week, setWeek] = useState("1");
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string | null>>({});

  const loadGames = useCallback(async () => {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const w = Number.parseInt(week, 10);
      const res = await fetch(
        `/api/admin/nfl/week-odds?nflSeasonYear=${encodeURIComponent(String(y))}&weekNumber=${encodeURIComponent(String(w))}`,
        { credentials: "include" },
      );
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Request failed"
            : "Request failed";
        setGames(null);
        setSnapshotMessage(msg);
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "games" in data &&
        Array.isArray((data as { games: unknown }).games)
      ) {
        setGames((data as { games: GameRow[] }).games);
      }
    } finally {
      setLoading(false);
    }
  }, [week, year]);

  async function runSnapshot() {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const w = Number.parseInt(week, 10);
      const res = await fetch("/api/admin/nfl/snapshot-odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nflSeasonYear: y, weekNumber: w }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Snapshot failed"
            : "Snapshot failed";
        setSnapshotMessage(msg);
        return;
      }
      setSnapshotMessage("Snapshot completed. Reloading lines…");
      await loadGames();
      setSnapshotMessage("Snapshot completed.");
    } finally {
      setLoading(false);
    }
  }

  async function recomputeJailed() {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const w = Number.parseInt(week, 10);
      const res = await fetch("/api/admin/nfl/week-jailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nflSeasonYear: y, weekNumber: w }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Jailed recompute failed"
            : "Jailed recompute failed";
        setSnapshotMessage(msg);
        return;
      }
      const team =
        typeof data === "object" &&
        data !== null &&
        "jailedTeam" in data &&
        typeof (data as { jailedTeam: unknown }).jailedTeam === "object" &&
        (data as { jailedTeam: unknown }).jailedTeam !== null
          ? (data as { jailedTeam: { name?: string; abbreviation?: string } }).jailedTeam
          : null;
      const resolvedBy =
        typeof data === "object" && data !== null && "resolvedBy" in data
          ? String((data as { resolvedBy: unknown }).resolvedBy)
          : null;
      const label =
        team?.name && team.abbreviation
          ? `${team.name} (${team.abbreviation})`
          : team?.name ?? "unknown team";
      setSnapshotMessage(
        `Jailed team recomputed: ${label}${resolvedBy ? ` by ${resolvedBy}` : ""}.`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function syncScheduleFromOdds() {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const res = await fetch("/api/admin/nfl/sync-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nflSeasonYear: y }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Schedule sync failed"
            : "Schedule sync failed";
        setSnapshotMessage(msg);
        return;
      }
      const upserted =
        typeof data === "object" && data !== null && "upserted" in data
          ? Number((data as { upserted: unknown }).upserted)
          : "?";
      const deleted =
        typeof data === "object" && data !== null && "deleted" in data
          ? Number((data as { deleted: unknown }).deleted)
          : "?";
      setSnapshotMessage(`Schedule synced from The Odds API (upserted ${upserted}, deleted orphans ${deleted}).`);
      await loadGames();
    } finally {
      setLoading(false);
    }
  }

  async function syncResultsFromOdds() {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const w = Number.parseInt(week, 10);
      const res = await fetch("/api/admin/nfl/sync-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nflSeasonYear: y, weekNumber: w }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Results sync failed"
            : "Results sync failed";
        setSnapshotMessage(msg);
        return;
      }
      const synced =
        typeof data === "object" && data !== null && "synced" in data
          ? Number((data as { synced: unknown }).synced)
          : "?";
      const skipped =
        typeof data === "object" && data !== null && "skipped" in data
          ? Number((data as { skipped: unknown }).skipped)
          : "?";
      setSnapshotMessage(
        `Results synced from The Odds API (synced ${synced}, skipped ${skipped}). Scores lookback is max 3 days — Wednesday/Thursday games older than that need a manual FINAL save.`,
      );
      await loadGames();
    } finally {
      setLoading(false);
    }
  }

  async function finalizeWeek() {
    setLoading(true);
    setSnapshotMessage(null);
    try {
      const y = Number.parseInt(year, 10);
      const w = Number.parseInt(week, 10);
      const res = await fetch("/api/admin/scoring/finalize-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nflSeasonYear: y, weekNumber: w }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Finalize failed"
            : "Finalize failed";
        setSnapshotMessage(msg);
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "allGamesFinalized" in data &&
        "finalCount" in data &&
        "notFinalCount" in data &&
        "scored" in data &&
        "skipped" in data
      ) {
        const summary = data as {
          allGamesFinalized: boolean;
          finalCount: number;
          notFinalCount: number;
          scored: number;
          skipped: number;
        };
        setSnapshotMessage(
          summarizeFinalizeWeekResult({
            weekNumber: w,
            allGamesFinalized: summary.allGamesFinalized,
            finalCount: summary.finalCount,
            notFinalCount: summary.notFinalCount,
            scored: summary.scored,
            skipped: summary.skipped,
          }),
        );
        return;
      }
      setSnapshotMessage("Finalize completed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveResult(g: GameRow, draft: { homeScore: string; awayScore: string }) {
    setRowError((prev) => ({ ...prev, [g.id]: null }));
    const homeScore = parseScore(draft.homeScore);
    const awayScore = parseScore(draft.awayScore);
    if (homeScore == null || awayScore == null) {
      setRowError((prev) => ({
        ...prev,
        [g.id]: "Enter whole-number home and away scores to mark FINAL.",
      }));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/nfl/games/${g.id}/result`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "FINAL", homeScore, awayScore }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "error" in data
            ? (data as ApiErr).error?.message ?? "Result save failed"
            : "Result save failed";
        setRowError((prev) => ({ ...prev, [g.id]: msg }));
        return;
      }
      await loadGames();
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(g: GameRow, draft: { h: string; a: string; s: string }) {
    setRowError((prev) => ({ ...prev, [g.id]: null }));
    const res = await fetch(`/api/admin/nfl/games/${g.id}/odds-line`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        homeMoneylineAmerican: parseNullableFloat(draft.h),
        awayMoneylineAmerican: parseNullableFloat(draft.a),
        homeSpreadPoints: parseNullableFloat(draft.s),
      }),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data === "object" && data !== null && "error" in data
          ? (data as ApiErr).error?.message ?? "Save failed"
          : "Save failed";
      setRowError((prev) => ({ ...prev, [g.id]: msg }));
      return;
    }
    await loadGames();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        NFL schedule, results, and odds lines are global (same for every league).{" "}
        <strong>Sync schedule (Odds)</strong> loads the full regular season from The Odds API events feed.{" "}
        <strong>Sync results (Odds)</strong> finalizes recently completed games (provider lookback max{" "}
        <strong>3 days</strong> — Thursday and earlier Wednesday games age out before Tuesday scoring).
        Save those scores as FINAL on the game row, then <strong>Finalize & score week</strong> to
        write standings. Odds lines come from snapshot or manual save. <strong>Recompute jailed</strong>{" "}
        overwrites the global jailed team for that week (every real league) from the latest snapshot
        lines — not the live picks-page overlay. Run a snapshot first if lines are missing or stale.
        Recompute is blocked after the pick deadline. Your league&apos;s first competition week
        {firstCompetitionWeek !== null ? (
          <>
            {" "}
            is <strong>NFL Week {firstCompetitionWeek}</strong>
          </>
        ) : (
          " is not loaded for this page"
        )}
        .
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="NFL season year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          sx={{ width: 160 }}
        />
        <TextField
          size="small"
          label="NFL week"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          sx={{ width: 120 }}
        />
        <Button variant="outlined" onClick={() => void syncScheduleFromOdds()} disabled={loading}>
          Sync schedule (Odds)
        </Button>
        <Button variant="outlined" onClick={() => void syncResultsFromOdds()} disabled={loading}>
          Sync results (Odds)
        </Button>
        <Button variant="outlined" onClick={() => void loadGames()} disabled={loading}>
          Load lines
        </Button>
        <Button variant="contained" color="secondary" onClick={() => void finalizeWeek()} disabled={loading}>
          Finalize & score week
        </Button>
        <Button variant="contained" onClick={() => void runSnapshot()} disabled={loading}>
          Run snapshot (API)
        </Button>
        <Button variant="outlined" onClick={() => void recomputeJailed()} disabled={loading}>
          Recompute jailed
        </Button>
      </Stack>
      {snapshotMessage ? (
        <Typography variant="body2" color="text.secondary">
          {snapshotMessage}
        </Typography>
      ) : null}
      {games === null ? (
        <Typography variant="body2" color="text.secondary">
          Choose year and week, then load lines or run a snapshot.
        </Typography>
      ) : games.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No games in the database for that NFL week — run Sync schedule (Odds) first.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {(() => {
            const unresolved = games.filter((g) => !isGameResolvedForScoring(g.status)).length;
            return unresolved > 0 ? (
              <Typography variant="body2" color="warning.main">
                {unresolved} game{unresolved === 1 ? "" : "s"} not FINAL — scoring will skip this week
                until every row is FINAL or CANCELLED.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                All games FINAL or CANCELLED — Finalize & score week can write standings.
              </Typography>
            );
          })()}
          {games.map((g) => (
            <OddsRow
              key={`${g.id}-${g.status}-${g.homeScore ?? "x"}-${g.awayScore ?? "x"}-${g.homeMoneylineAmerican ?? "x"}-${g.awayMoneylineAmerican ?? "x"}-${g.homeSpreadPoints ?? "x"}`}
              game={g}
              onSave={saveRow}
              onSaveResult={saveResult}
              disabled={loading}
              errorText={rowError[g.id] ?? null}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function OddsRow({
  game,
  onSave,
  onSaveResult,
  disabled,
  errorText,
}: {
  game: GameRow;
  onSave: (g: GameRow, draft: { h: string; a: string; s: string }) => Promise<void>;
  onSaveResult: (g: GameRow, draft: { homeScore: string; awayScore: string }) => Promise<void>;
  disabled: boolean;
  errorText: string | null;
}) {
  const [h, setH] = useState(moneylineDraftValue(game.homeMoneylineAmerican));
  const [a, setA] = useState(moneylineDraftValue(game.awayMoneylineAmerican));
  const [s, setS] = useState(game.homeSpreadPoints ?? "");
  const [homeScore, setHomeScore] = useState(game.homeScore == null ? "" : String(game.homeScore));
  const [awayScore, setAwayScore] = useState(game.awayScore == null ? "" : String(game.awayScore));
  const resolved = isGameResolvedForScoring(game.status);

  return (
    <Stack
      spacing={1}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="subtitle2">
          {game.awayAbbreviation} @ {game.homeAbbreviation} — {new Date(game.kickoffAt).toISOString()}
        </Typography>
        <Chip
          size="small"
          label={
            game.status === "FINAL" && game.awayScore != null && game.homeScore != null
              ? `FINAL ${game.awayScore}–${game.homeScore}`
              : game.status
          }
          color={resolved ? "success" : "warning"}
        />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <TextField
          size="small"
          label={`Away score (${game.awayAbbreviation})`}
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          label={`Home score (${game.homeAbbreviation})`}
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          sx={{ width: 140 }}
        />
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={() => void onSaveResult(game, { homeScore, awayScore })}
        >
          Save result as FINAL
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <TextField
          size="small"
          label="Home ML (decimal)"
          value={h}
          onChange={(e) => setH(e.target.value)}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Away ML (decimal)"
          value={a}
          onChange={(e) => setA(e.target.value)}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Home spread"
          helperText="Negative = home favored"
          value={s}
          onChange={(e) => setS(e.target.value)}
          sx={{ width: 140 }}
        />
        <Button variant="outlined" disabled={disabled} onClick={() => void onSave(game, { h, a, s })}>
          Save manual line
        </Button>
      </Stack>
      {errorText ? (
        <Typography variant="caption" color="error">
          {errorText}
        </Typography>
      ) : null}
    </Stack>
  );
}
