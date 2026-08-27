/**
 * MVP league “configuration” (FR1) is **not** user-editable. Product rules are implemented across
 * epics; this module is the **single documentation anchor** for defaults and placeholders.
 *
 * | Area | MVP behavior |
 * |------|----------------|
 * | Pick deadline | **FR26:** five minutes before the first game **or** Thursday **8:10 PM** Eastern—earlier (stricter). Implemented in `src/lib/domain/pick-deadline.ts` (`LEAGUE_BUSINESS_TIMEZONE` below; UTC compare). |
 * | Scoring (1 vs 2, anti-jailed) | Epic 5 — domain logic in `src/lib/domain` when built. |
 * | Jailed team / tie-break | Epic 3–4. |
 * | Pick visibility (dual gate) | Opponents tab after week deadline; Results/peer history after week finalize (admins see team picks after that week’s pick deadline, FR49). Enforce in queries and RSC data, not UI-only. |
 * | Admin overrides | Audited mutations (PRD). |
 */
export const LEAGUE_BUSINESS_TIMEZONE = "America/New_York" as const;
