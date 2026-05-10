/**
 * Story 3.7 — pure helper that maps "which visual state should this side of the matchup card render?"
 *
 * Evaluation order (matches Story 3.7 MatchupCard precedence / dev notes):
 *   1. **Jailed** — jailed team side always shows the jailed treatment.
 *   2. **AlreadyPicked** — team was used in another week (`seasonPickedTeams`; current week excluded).
 *   3. **Selected** — user's current-week pick gets the primary highlight.
 *   4. **Locked** — deadline passed; only applies if none of the above matched (default sides only).
 *   5. **Default** — neutral.
 *
 * Selected / jailed / already-picked states "win" before `locked`, so the saved pick stays visually
 * selected after the deadline while other sides show `locked` (AC #7).
 */

export type MatchupSideState =
  | "default"
  | "selected"
  | "jailed"
  | "alreadyPicked"
  | "locked";

export type ComputeMatchupSideStateInput = {
  teamId: string;
  jailedTeamId: string | null;
  /** Set of team ids the participant has saved in **other** weeks of the same season. */
  pickedTeamIds: ReadonlySet<string>;
  /** The participant's saved current-week pick (always keeps the "selected" highlight). */
  selectedTeamId: string | null;
  /** True when the active-week deadline has passed (or any other lock condition). */
  isLocked: boolean;
};

export function computeMatchupSideState(
  input: ComputeMatchupSideStateInput,
): MatchupSideState {
  const { teamId, jailedTeamId, pickedTeamIds, selectedTeamId, isLocked } = input;

  if (jailedTeamId != null && jailedTeamId === teamId) {
    return "jailed";
  }
  if (pickedTeamIds.has(teamId)) {
    return "alreadyPicked";
  }
  if (selectedTeamId === teamId) {
    return "selected";
  }
  if (isLocked) {
    return "locked";
  }
  return "default";
}
