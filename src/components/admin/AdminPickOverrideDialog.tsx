"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import type { GameTeamPair } from "@/lib/admin/build-admin-override-data";
import { getOpponentOfJailedInWeek } from "@/lib/domain/picks";

export type AdminPickOverrideDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leagueId: string;
  weekNumber: number;
  targetMembershipId: string;
  displayName: string;
  currentPick: { teamId: string; teamName: string; antiJailedBonus: boolean } | null;
  weekGames: GameTeamPair[];
  jailedTeamId: string;
  priorPickTeamIds: string[];
};

type TeamOption = {
  teamId: string;
  teamName: string;
  abbreviation: string;
};

export function AdminPickOverrideDialog({
  open,
  onClose,
  onSuccess,
  leagueId,
  weekNumber,
  targetMembershipId,
  displayName,
  currentPick,
  weekGames,
  jailedTeamId,
  priorPickTeamIds,
}: AdminPickOverrideDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    currentPick?.teamId ?? null,
  );
  const [antiJailed, setAntiJailed] = useState(currentPick?.antiJailedBonus ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P3: only reset state on the closed→open transition so an in-progress selection
  // is not wiped by a background router.refresh() that causes a prop change while
  // the dialog is already open.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (open && !wasOpen) {
      setSelectedTeamId(currentPick?.teamId ?? null);
      setAntiJailed(currentPick?.antiJailedBonus ?? false);
      setError(null);
    }
  }, [open, currentPick?.teamId, currentPick?.antiJailedBonus]);

  const antiJailedOpponentId = (() => {
    const pairs = weekGames.map((g) => ({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
    }));
    const opp = getOpponentOfJailedInWeek(jailedTeamId, pairs);
    return opp.ok ? opp.opponentTeamId : null;
  })();

  // P4: if the jailed team has no opponent in this week's schedule, the anti-jailed
  // checkbox is never rendered — but antiJailed state could be stale (true from a
  // previous pick). Clear it so the hidden value is not submitted silently.
  useEffect(() => {
    if (antiJailedOpponentId === null) {
      setAntiJailed(false);
    }
  }, [antiJailedOpponentId]);

  const handleTeamSelect = useCallback(
    (teamId: string) => {
      if (priorPickTeamIds.includes(teamId)) return;
      setSelectedTeamId(teamId);
      if (teamId !== antiJailedOpponentId) {
        setAntiJailed(false);
      }
      setError(null);
    },
    [priorPickTeamIds, antiJailedOpponentId],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedTeamId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/admin/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMembershipId,
          teamId: selectedTeamId,
          nflWeekNumber: weekNumber,
          antiJailedBonus: antiJailed,
        }),
      });
      if (res.ok) {
        // P5: call onSuccess() last — it unmounts the dialog, so setLoading must not
        // run afterwards (no finally block here for the success path).
        onSuccess();
        return;
      }
      const data = (await res.json()) as { error?: { message?: string } };
      setError(data.error?.message ?? "Failed to save pick");
    } catch {
      setError("Failed to save pick");
    }
    setLoading(false);
  }, [
    selectedTeamId,
    leagueId,
    targetMembershipId,
    weekNumber,
    antiJailed,
    onSuccess,
  ]);

  const saveDisabled = !selectedTeamId || loading;

  function renderTeamChip(team: TeamOption) {
    const isJailed = team.teamId === jailedTeamId;
    const isPriorPick = priorPickTeamIds.includes(team.teamId);
    const isSelected = selectedTeamId === team.teamId;

    return (
      <Stack key={team.teamId} direction="row" spacing={0.5} alignItems="center">
        <Chip
          label={team.abbreviation}
          clickable={!isPriorPick}
          disabled={isPriorPick}
          color={isSelected ? "primary" : "default"}
          variant={isSelected ? "filled" : "outlined"}
          onClick={() => handleTeamSelect(team.teamId)}
          aria-label={team.teamName}
        />
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
          {team.teamName}
        </Typography>
        {isJailed && (
          <Chip
            label="JAILED"
            size="small"
            sx={{
              bgcolor: (t) => `${t.palette.warning.main}26`,
              color: (t) => t.palette.warning.main,
              fontWeight: 600,
            }}
          />
        )}
      </Stack>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Override pick for {displayName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {currentPick
              ? `Current pick: ${currentPick.teamName}${currentPick.antiJailedBonus ? " (+2 anti-jailed)" : ""}`
              : "No current pick yet"}
          </Typography>

          <Stack spacing={1}>
            <Typography variant="subtitle2">Select team</Typography>
            {weekGames.map((game) => (
              <Stack key={`${game.homeTeamId}-${game.awayTeamId}`} spacing={0.75}>
                {renderTeamChip({
                  teamId: game.homeTeamId,
                  teamName: game.homeTeamName,
                  abbreviation: game.homeTeamAbbreviation,
                })}
                {renderTeamChip({
                  teamId: game.awayTeamId,
                  teamName: game.awayTeamName,
                  abbreviation: game.awayTeamAbbreviation,
                })}
              </Stack>
            ))}
          </Stack>

          {selectedTeamId === antiJailedOpponentId && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={antiJailed}
                  onChange={(e) => setAntiJailed(e.target.checked)}
                />
              }
              label="Anti-jailed bonus (+2 pts)"
            />
          )}

          {error != null && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saveDisabled}>
          Save pick
        </Button>
      </DialogActions>
    </Dialog>
  );
}
