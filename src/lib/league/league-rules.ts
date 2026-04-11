/**
 * MVP league “configuration” (FR1) is **not** user-editable. Product rules are implemented across
 * epics; this module is the **single documentation anchor** for defaults and placeholders.
 *
 * | Area | MVP behavior |
 * |------|----------------|
 * | Pick deadline | Server-authoritative; wall clock in **`America/New_York`** (see PRD / Epic 3). |
 * | Scoring (1 vs 2, anti-jailed) | Epic 5 — domain logic in `src/lib/domain` when built. |
 * | Jailed team / tie-break | Epic 3–4. |
 * | Pick visibility (Tuesday reveal) | FR48–FR49 — enforce in queries and RSC data, not UI-only. |
 * | Admin overrides | Audited mutations (PRD). |
 */
export const LEAGUE_BUSINESS_TIMEZONE = "America/New_York" as const;
