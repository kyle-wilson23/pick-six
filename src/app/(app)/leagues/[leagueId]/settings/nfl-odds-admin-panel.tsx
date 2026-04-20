"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

type ApiErr = { error?: { code?: string; message?: string } };

type GameRow = {
  id: string;
  kickoffAt: string;
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

function parseNullableInt(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseNullableFloat(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
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

  async function saveRow(g: GameRow, draft: { h: string; a: string; s: string }) {
    setRowError((prev) => ({ ...prev, [g.id]: null }));
    const res = await fetch(`/api/admin/nfl/games/${g.id}/odds-line`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        homeMoneylineAmerican: parseNullableInt(draft.h),
        awayMoneylineAmerican: parseNullableInt(draft.a),
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
        NFL odds are global (same for every league). Lines come from the latest successful snapshot or manual save
        per game; nothing refreshes automatically between snapshots (Tuesday cadence is manual here until Epic 6).
        Your league&apos;s first competition week
        {firstCompetitionWeek !== null ? (
          <>
            {" "}
            is <strong>NFL Week {firstCompetitionWeek}</strong>
          </>
        ) : (
          " is not loaded for this page"
        )}
        ; snapshot triggers still use the NFL season year and week you enter (e.g. Week 1 in pre-season for smoke
        tests).
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
        <Button variant="outlined" onClick={() => void loadGames()} disabled={loading}>
          Load lines
        </Button>
        <Button variant="contained" onClick={() => void runSnapshot()} disabled={loading}>
          Run snapshot (API)
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
          No games in the database for that NFL week — seed or import the schedule first.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {games.map((g) => (
            <OddsRow
              key={`${g.id}-${g.homeMoneylineAmerican ?? "x"}-${g.awayMoneylineAmerican ?? "x"}-${g.homeSpreadPoints ?? "x"}`}
              game={g}
              onSave={saveRow}
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
  disabled,
  errorText,
}: {
  game: GameRow;
  onSave: (g: GameRow, draft: { h: string; a: string; s: string }) => Promise<void>;
  disabled: boolean;
  errorText: string | null;
}) {
  const [h, setH] = useState(
    game.homeMoneylineAmerican === null ? "" : String(game.homeMoneylineAmerican),
  );
  const [a, setA] = useState(
    game.awayMoneylineAmerican === null ? "" : String(game.awayMoneylineAmerican),
  );
  const [s, setS] = useState(game.homeSpreadPoints ?? "");

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
      <Typography variant="subtitle2">
        {game.awayAbbreviation} @ {game.homeAbbreviation} — {new Date(game.kickoffAt).toISOString()}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <TextField
          size="small"
          label="Home ML"
          value={h}
          onChange={(e) => setH(e.target.value)}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Away ML"
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
