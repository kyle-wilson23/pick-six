/** Shared focus-visible ring — UX Focus Indicators (2px primary + 2px offset). */
export const focusVisibleRingSx = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: 2,
} as const;

/**
 * Skip-link target (`#main-content`): suppress default outline until focused,
 * then show the same ring (programmatic focus often won't match `:focus-visible`).
 */
export const skipTargetMainSx = {
  outline: "none",
  "&:focus": focusVisibleRingSx,
} as const;

/** CSS-in-JS fragment for MUI `styleOverrides` (theme callback). */
export function focusVisibleRingCss(primaryMain: string) {
  return {
    outline: `2px solid ${primaryMain}`,
    outlineOffset: 2,
  } as const;
}
