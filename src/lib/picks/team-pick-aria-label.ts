import type { MatchupSideState } from "@/lib/picks/matchup-card-state";

export type BuildTeamPickAriaLabelInput = {
  teamName: string;
  moneylineLabel: string;
  /** Signed spread already formatted for display, e.g. "-5.5". Omitted when the line is missing. */
  spreadLabel?: string | null;
  state: MatchupSideState;
  /** Week number when `state === "alreadyPicked"`. */
  pickedInWeek?: number;
};

/**
 * Accessible name for a matchup team radio — includes actionable state so SR users
 * are not dependent on visually-hidden JAILED/PICKED overlays.
 */
export function buildTeamPickAriaLabel(input: BuildTeamPickAriaLabelInput): string {
  const { teamName, moneylineLabel, spreadLabel, state, pickedInWeek } = input;
  const spread = spreadLabel ? `, spread ${spreadLabel}` : "";
  const base = `${teamName}, moneyline ${moneylineLabel}${spread}`;

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
