/** Full team identity — only when the pick window is closed, or for the viewer's own row. */
export type AdminSubmittedPickVisible = {
  teamName: string;
  teamAbbreviation: string;
  antiJailedBonus: boolean;
  updatedAt: string;
};

/** Submitted, but team identity redacted (open window / indeterminate deadline). */
export type AdminSubmittedPickRedacted = {
  updatedAt: string;
};

export type AdminSubmittedPick = AdminSubmittedPickVisible | AdminSubmittedPickRedacted;

export function isAdminSubmittedPickVisible(
  pick: AdminSubmittedPick | null | undefined,
): pick is AdminSubmittedPickVisible {
  return pick != null && "teamName" in pick;
}
