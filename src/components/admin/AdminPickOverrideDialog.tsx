"use client";

import { useCallback, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
  pickWindowClosed: boolean;
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
  pickWindowClosed,
  weekGames,
  jailedTeamId,
  priorPickTeamIds,
}: AdminPickOverrideDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    pickWindowClosed ? (currentPick?.teamId ?? null) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const antiJailedOpponentId = (() => {
    const pairs = weekGames.map((g) => ({
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
    }));
    const opp = getOpponentOfJailedInWeek(jailedTeamId, pairs);
    return opp.ok ? opp.opponentTeamId : null;
  })();

  const handleTeamSelect = useCallback(
    (teamId: string) => {
      if (priorPickTeamIds.includes(teamId)) return;
      setSelectedTeamId(teamId);
      setError(null);
    },
    [priorPickTeamIds],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedTeamId) return;
    setLoading(true);
    setError(null);
    const antiJailedBonus =
      antiJailedOpponentId != null && selectedTeamId === antiJailedOpponentId;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/admin/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMembershipId,
          teamId: selectedTeamId,
          nflWeekNumber: weekNumber,
          antiJailedBonus,
        }),
      });
      if (res.ok) {
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
    antiJailedOpponentId,
    onSuccess,
  ]);

  const saveDisabled = !selectedTeamId || loading;

  function renderTeamChip(team: TeamOption) {
    const isJailed = team.teamId === jailedTeamId;
    const isPriorPick = priorPickTeamIds.includes(team.teamId);
    const isSelected = selectedTeamId === team.teamId;
    const isAntiJailedOpponent = team.teamId === antiJailedOpponentId;

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
        {isAntiJailedOpponent && (
          <Chip
            label="2 PTS"
            size="small"
            aria-label="2-point anti-jailed pick"
            sx={{
              cursor: "default",
              fontWeight: 700,
              bgcolor: (t) => t.palette.accent.gold,
              color: (t) => t.palette.getContrastText(t.palette.accent.gold),
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
          {pickWindowClosed ? (
            <Typography variant="body2" color="text.secondary">
              {currentPick
                ? `Current pick: ${currentPick.teamName}${currentPick.antiJailedBonus ? " (+2 anti-jailed)" : ""}`
                : "No current pick yet"}
            </Typography>
          ) : null}

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
            <Typography variant="body2" color="text.secondary">
              Opponent of the jailed team — always a 2-point anti-jailed pick.
            </Typography>
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
