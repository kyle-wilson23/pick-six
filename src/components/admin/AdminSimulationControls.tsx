"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { isSimulationComplete, nextSimulationWeek } from "@/lib/league/simulation-week";

export type AdminSimulationControlsProps = {
  leagueId: string;
  firstCompetitionWeek: number;
  simulationWeekCount: number | null;
  simulatedCurrentWeek: number | null;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

type ApplyOddsSuccessBody = {
  weekNumber?: number;
  gamesInWeek?: number;
  jailedTeamAbbreviation?: string;
  resolvedBy?: string;
};

export function AdminSimulationControls({
  leagueId,
  firstCompetitionWeek,
  simulationWeekCount,
  simulatedCurrentWeek,
}: AdminSimulationControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [oddsSubmitting, setOddsSubmitting] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [oddsSuccess, setOddsSuccess] = useState<string | null>(null);

  const notConfigured = simulationWeekCount == null;
  const notStarted = simulatedCurrentWeek == null;
  const complete =
    simulationWeekCount != null &&
    simulatedCurrentWeek != null &&
    isSimulationComplete({
      firstCompetitionWeek,
      simulationWeekCount,
      simulatedCurrentWeek,
    });
  const nextWeek = nextSimulationWeek({
    firstCompetitionWeek,
    simulationWeekCount,
    simulatedCurrentWeek,
  });

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setErrorMessage(null);
  }

  async function handleConfirm() {
    if (simulatedCurrentWeek == null || nextWeek == null) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/simulation/advance-week`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromWeek: simulatedCurrentWeek }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const body = data as ApiErrorBody | null;
        const msg = body?.error?.message ?? "Could not advance simulation week";
        setErrorMessage(msg);
        if (body?.error?.code === "SIMULATION_WEEK_STALE") {
          router.refresh();
        }
        return;
      }
      setOpen(false);
      setOddsSuccess(null);
      setOddsError(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyOddsSnapshot() {
    if (simulatedCurrentWeek == null) return;
    setOddsError(null);
    setOddsSuccess(null);
    setOddsSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/simulation/apply-odds-snapshot`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const body = data as ApiErrorBody | null;
        setOddsError(body?.error?.message ?? "Could not apply odds snapshot");
        return;
      }
      const body = data as ApplyOddsSuccessBody | null;
      if (!body) {
        setOddsError("Received an unexpected response from the server");
        return;
      }
      const week = body.weekNumber ?? simulatedCurrentWeek;
      const games = body.gamesInWeek ?? 0;
      const abbr = body.jailedTeamAbbreviation ?? "?";
      const by = body.resolvedBy ?? "?";
      setOddsSuccess(
        `Applied fixture odds for Week ${week} — ${games} games, jailed team: ${abbr} (${by}).`,
      );
      router.refresh();
    } catch {
      setOddsError("Network error — could not reach the server");
    } finally {
      setOddsSubmitting(false);
    }
  }

  let statusLine: string;
  if (notConfigured) {
    statusLine = "Simulation week count is not configured for this league.";
  } else if (notStarted) {
    statusLine =
      "Simulation not started. Mark the league ready for season to begin at Week " +
      firstCompetitionWeek +
      ".";
  } else if (complete) {
    statusLine = `Simulation complete — Week ${simulatedCurrentWeek} of ${simulationWeekCount}.`;
  } else {
    statusLine = `Current simulated week: ${simulatedCurrentWeek} of ${simulationWeekCount}.`;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6" component="h2">
          Simulation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {statusLine}
        </Typography>
        <Button
          variant="contained"
          disabled={notConfigured || notStarted || complete || nextWeek == null || oddsSubmitting}
          onClick={() => {
            setErrorMessage(null);
            setOpen(true);
          }}
        >
          {nextWeek != null ? `Advance to Week ${nextWeek}` : "Advance week"}
        </Button>
        <Button
          variant="outlined"
          disabled={notStarted || oddsSubmitting || submitting}
          onClick={() => void handleApplyOddsSnapshot()}
        >
          {oddsSubmitting
            ? "Applying…"
            : simulatedCurrentWeek != null
              ? `Apply odds snapshot for Week ${simulatedCurrentWeek}`
              : "Apply odds snapshot"}
        </Button>
        {oddsSuccess ? <Alert severity="success">{oddsSuccess}</Alert> : null}
        {oddsError ? <Alert severity="error">{oddsError}</Alert> : null}
      </Stack>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {nextWeek != null ? `Advance to Week ${nextWeek}?` : "Advance simulation week?"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This moves the rehearsal clock from Week {simulatedCurrentWeek} to Week {nextWeek}.
              It does not create games or scores — only the week pointer changes.
            </Typography>
            {errorMessage ? (
              <Alert severity="error">{errorMessage}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={submitting}>
            {submitting ? "Advancing…" : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
