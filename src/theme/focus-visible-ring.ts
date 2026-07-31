/** Shared focus-visible ring — UX Focus Indicators (2px primary + 2px offset). */
export const focusVisibleRingSx = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: 2,
} as const;

/** Desktop fixed AppBar / Toolbar spacer height (`LeagueNavShell`). */
export const DESKTOP_APP_BAR_OFFSET_PX = 64;

/**
 * Skip-link target (`#main-content`): no default outline; show ring only for
 * keyboard/skip-link focus (`:focus-visible`), not incidental focus after nav clicks.
 * `scrollMarginTop` keeps focus/scrollIntoView from tucking content under the fixed AppBar
 * (Next App Router focuses the segment root after client navigations).
 */
export const skipTargetMainSx = {
  outline: "none",
  scrollMarginTop: { xs: 0, md: `${DESKTOP_APP_BAR_OFFSET_PX}px` },
  "&:focus-visible": focusVisibleRingSx,
} as const;

/** CSS-in-JS fragment for MUI `styleOverrides` (theme callback). */
export function focusVisibleRingCss(primaryMain: string) {
  return {
    outline: `2px solid ${primaryMain}`,
    outlineOffset: 2,
  } as const;
}
