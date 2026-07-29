/** Shared focus-visible ring — UX Focus Indicators (2px primary + 2px offset). */
export const focusVisibleRingSx = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: 2,
} as const;

/**
 * Skip-link target (`#main-content`): no default outline; show ring only for
 * keyboard/skip-link focus (`:focus-visible`), not incidental focus after nav clicks.
 */
export const skipTargetMainSx = {
  outline: "none",
  "&:focus-visible": focusVisibleRingSx,
} as const;

/** CSS-in-JS fragment for MUI `styleOverrides` (theme callback). */
export function focusVisibleRingCss(primaryMain: string) {
  return {
    outline: `2px solid ${primaryMain}`,
    outlineOffset: 2,
  } as const;
}
