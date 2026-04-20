# Story 3.9: NFL schedule provider — spike, choice, and `NflGame` sync

Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want an **evaluated and implemented** path to **populate or refresh** regular-season **`NflGame`** rows from a **schedule-first** third-party API,
so that we **do not** rely indefinitely on **seed JSON** (`prisma/data`, `prisma/seed.cjs`) for matchups and kickoffs (**follow-up from Story 3.2** and **`docs/nfl-odds-integration.md`**), and **picks / deadlines** (Epic 3+) always target **real games** for the active **`nflSeasonYear`**.

**Priority:** **High** within Epic 3 — start soon after **3.2** is accepted; may overlap **3.3** where there is no dependency conflict.

**Cost:** **Free of recurring cost is a priority** — prefer providers and usage patterns that stay within a **documented free tier** (or otherwise **$0** for MVP-scale traffic). If no free-tier option can meet NFL schedule + quality needs, the spike must **document that conclusion** and justify any **paid** path before implementation (aligned with **`docs/project-context.md`** hosting/cost goals).

## Acceptance Criteria

1. **Given** **`Team`** and **`NflGame`** from Story **3.1** and the **split-provider** decision in Story **3.2** / **`docs/nfl-odds-integration.md`**  
   **When** the spike completes  
   **Then** at least **two** credible **schedule-first** providers are evaluated in writing (e.g. **API-Sports** NFL fixtures, **SportsDataIO** NFL schedule trial, or others with justified fit) on: **pricing / free tier** (with **preference for $0 recurring**), **request limits** vs our **weekly or batch sync** cadence, **NFL regular-season coverage (weeks 1–18)**, **kickoff instants (UTC)**, **alignment with our `weekNumber` (1–18)**, **mapping provider team identifiers → `Team.id` / `abbreviation`**, **self-serve vs sales**, and **compliance / terms**

2. **Given** the comparison  
   **When** a provider is selected  
   **Then** the decision, **rejected alternatives summary**, and **fallback** if the vendor changes tier or fields are recorded in **`docs/nfl-odds-integration.md`** (or **`docs/nfl-schedule-integration.md`** if the doc splits for length)  
   **And** if the chosen path is **not** free at MVP usage, the write-up **states why** no acceptable **zero-cost** option worked

3. **Given** a server-only API key (name TBD, e.g. `NFL_SCHEDULE_API_KEY`)  
   **When** the app runs  
   **Then** **no** schedule secrets appear in client bundles, **`NEXT_PUBLIC_*`**, or logged raw responses (**`docs/project-context.md`** #1)

4. **Given** the chosen API  
   **When** sync runs for **`getCurrentNflSeasonYear()`**  
   **Then** **`NflGame`** rows are **upserted** for regular-season weeks **1–18** (or a **documented** subset for first ship + phased follow-up) with **home/away** FKs and **UTC kickoff**, **idempotent** re-runs (same logical game → same row or stable merge strategy), without breaking **`Pick`** FKs or **`@@unique([leagueMembershipId, seasonId, nflWeekNumber])`**

5. **Given** upstream failure or partial data  
   **When** sync runs  
   **Then** errors are **structured** and **logged** (**NFR45**); the system **does not** claim success for failed weeks

6. **Given** admin or operator need  
   **When** they trigger sync  
   **Then** a **Route Handler** and/or **`scripts/`** entry is documented (manual until Epic **6** cron); **Zod** on inputs; **CSRF** / **`ODDS_SNAPSHOT_SECRET`-style** bearer pattern as appropriate for automation

7. **Given** CI  
   **When** **`npm test`** runs  
   **Then** mapping and upsert logic are covered with **fixtures** (no live network by default)

## Tasks / Subtasks

- [ ] **Spike & comparison doc** — Evaluate ≥2 providers; record table + recommendation + fallback (AC1–2); **prioritize free-tier / $0** viability and document any paid choice.
- [ ] **Env & `.env.example`** — Document server-only key(s); never `NEXT_PUBLIC_`.
- [ ] **`src/lib/integrations/`** (or `src/lib/nfl/`) — Adapter: fetch → Zod → domain DTO → map to `Team` / week / kickoff.
- [ ] **Upsert service** — Transactional `NflGame` upsert keyed by `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` or provider event id stored on game (add column only if needed; justify in Dev Notes).
- [ ] **Trigger** — POST admin route and/or script; structured JSON errors.
- [ ] **Tests** — Vitest + JSON fixtures.
- [ ] **Regression** — `npm run lint`, `npm test`, `npm run build`, migration if schema changes.

## Dev Notes

### Epic context

- **3.1** seeded **Week 1** minimum; **3.2** uses **The Odds API** for lines matched to existing games. **3.9** owns **schedule ingestion** so the DB can hold **full season** data without hand-maintained JSON at scale.
- **Dependencies:** Safe to implement after **3.1**; coordinate with **3.4/3.5** if sync could touch rows referenced by picks (upsert should preserve **`NflGame.id`** when possible, or document migration).

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Cost** | **Prefer $0 recurring** (free tier / sufficient quota for batch sync). Paid only with **documented** justification if no viable free option. |
| **Time** | Kickoffs **UTC**; `America/New_York` for display only in later UI |
| **DB** | **`@map` snake_case**; **`cuid()`** ids; global NFL rows **not** cascading from `League` delete |
| **Errors** | `{ error: { code, message } }` on APIs |

### References

- **`docs/nfl-odds-integration.md`** — prior provider comparison; **extend** with schedule-specific decision.
- **`prisma/schema.prisma`** — `NflGame` indexes and FKs.

## Dev Agent Record

### Agent Model Used

_(filled on implementation)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- **2026-04-19** — Story created for Epic 3: schedule provider spike + `NflGame` sync; **`epics.md`** and **`sprint-status.yaml`** updated. Status **backlog**.
- **2026-04-19** — Noted **free of recurring cost** as a priority for provider choice and spike documentation.
