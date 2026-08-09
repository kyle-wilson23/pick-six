/**
 * Pure draft-vs-saved comparison for the picks confirm FAB.
 * Dirty when the user has a draft that is not yet equal to the last saved pick.
 */

export type PickSelection = {
  teamId: string;
  antiJailedBonus: boolean;
};

export function isPickDraftDirty(
  draft: PickSelection | null,
  saved: PickSelection | null,
): boolean {
  if (draft == null) return false;
  if (saved == null) return true;
  return draft.teamId !== saved.teamId || draft.antiJailedBonus !== saved.antiJailedBonus;
}
