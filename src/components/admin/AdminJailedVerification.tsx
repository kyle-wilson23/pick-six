"use client";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type {
  JailedCandidateView,
  JailedVerificationView,
} from "@/lib/admin/get-jailed-verification";

export type AdminJailedVerificationProps = {
  verification: JailedVerificationView | null;
  weekNumber: number | null;
};

function formatTimestamp(isoUtc: string): string {
  const d = new Date(isoUtc);
  return isNaN(d.getTime()) ? isoUtc : d.toLocaleString();
}

function formatAmericanOdds(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function resolutionChipColor(
  resolvedBy: JailedVerificationView["resolvedBy"],
): "success" | "warning" | "error" {
  switch (resolvedBy) {
    case "MONEYLINE":
      return "success";
    case "SPREAD":
      return "warning";
    case "RANDOM":
      return "error";
    default: {
      const _x: never = resolvedBy;
      return _x;
    }
  }
}

function isInSlice(
  candidate: JailedCandidateView,
  slice: JailedCandidateView[] | null,
): boolean {
  if (!slice?.length) {
    return false;
  }
  return slice.some((c) => c.nflGameId === candidate.nflGameId);
}

function candidateStatusChips(
  candidate: JailedCandidateView,
  verification: JailedVerificationView,
): { label: string; color: "warning" | "info" | "default" }[] {
  const chips: { label: string; color: "warning" | "info" | "default" }[] = [];
  if (candidate.favoriteTeamId === verification.jailedTeamId) {
    chips.push({ label: "JAILED", color: "warning" });
  }
  if (isInSlice(candidate, verification.afterSpread)) {
    chips.push({ label: "SPREAD tie", color: "info" });
  }
  if (isInSlice(candidate, verification.afterMoneyline)) {
    chips.push({ label: "ML tie", color: "info" });
  }
  return chips;
}

export function AdminJailedVerification({
  verification,
  weekNumber,
}: AdminJailedVerificationProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Jailed Team Verification
      </Typography>

      {verification === null ? (
        <Typography color="text.secondary">
          {weekNumber != null
            ? `No jailed team computed yet for Week ${weekNumber}. Run jailed team computation after the Tuesday odds snapshot.`
            : "No active week — jailed team computation unavailable."}
        </Typography>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {verification.jailedTeamName}
              </Typography>
              <Chip
                size="small"
                label={`Resolved by: ${verification.resolvedBy}`}
                color={resolutionChipColor(verification.resolvedBy)}
              />
              <Typography variant="body2">
                {verification.gamesWithCompleteLines} of {verification.gamesInWeek} games had
                complete lines
              </Typography>
              <Typography variant="body2">
                Winning moneyline: {formatAmericanOdds(verification.winningMoneylineAmerican)}
              </Typography>
              {verification.resolvedBy === "RANDOM" && verification.randomSeed ? (
                <Typography variant="caption" color="text.secondary">
                  Random seed: {verification.randomSeed} (used for FR52 auditability)
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                Computed {formatTimestamp(verification.computedAt)}
              </Typography>
            </Stack>
          </Paper>

          {verification.afterMoneyline != null && verification.afterMoneyline.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              Moneyline tie — {verification.afterMoneyline.length} teams advanced to spread
              tie-break
            </Typography>
          ) : null}

          {verification.afterSpread != null && verification.afterSpread.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              Spread tie — {verification.afterSpread.length} teams advanced to random selection
            </Typography>
          ) : null}

          <Stack spacing={1}>
            <Typography variant="subtitle2">Candidate Games (complete lines)</Typography>
            {verification.candidates.length === 0 ? (
              <Typography color="text.secondary">No candidates recorded.</Typography>
            ) : (
              <Stack spacing={1} aria-label="Jailed candidate games">
                {verification.candidates.map((candidate) => {
                  const chips = candidateStatusChips(candidate, verification);
                  return (
                    <Paper
                      key={candidate.nflGameId}
                      variant="outlined"
                      sx={{ px: 2, py: 1 }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={1}
                      >
                        <Typography variant="body2">
                          {candidate.homeTeamName} vs {candidate.awayTeamName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatAmericanOdds(candidate.homeMoneylineAmerican)} /{" "}
                          {formatAmericanOdds(candidate.awayMoneylineAmerican)} — Spread:{" "}
                          {candidate.spreadInFavoriteFavor} (fav: {candidate.favoriteTeamName})
                        </Typography>
                        {chips.length > 0 ? (
                          <Stack direction="row" spacing={0.5}>
                            {chips.map((chip) => (
                              <Chip key={chip.label} size="small" label={chip.label} color={chip.color} />
                            ))}
                          </Stack>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
