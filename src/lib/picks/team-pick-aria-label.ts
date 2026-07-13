import type { MatchupSideState } from "@/lib/picks/matchup-card-state";

export type BuildTeamPickAriaLabelInput = {
  teamName: string;
  moneylineLabel: string;
  state: MatchupSideState;
  /** Week number when `state === "alreadyPicked"`. */
  pickedInWeek?: number;
};

/**
 * Accessible name for a matchup team radio — includes actionable state so SR users
 * are not dependent on visually-hidden JAILED/PICKED overlays.
 */
export function buildTeamPickAriaLabel(input: BuildTeamPickAriaLabelInput): string {
  const { teamName, moneylineLabel, state, pickedInWeek } = input;
  const base = `${teamName}, moneyline ${moneylineLabel}`;

  switch (state) {
    case "jailed":
      return `${base}, jailed`;
    case "alreadyPicked":
      return pickedInWeek != null
        ? `${base}, already picked week ${pickedInWeek}`
        : `${base}, already picked`;
    case "selected":
      return `${base}, selected`;
    case "locked":
      return `${base}, locked`;
    default:
      return base;
  }
}
