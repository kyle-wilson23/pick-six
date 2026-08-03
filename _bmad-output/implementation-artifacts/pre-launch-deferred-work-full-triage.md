# Pre-launch: Deferred-work full triage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the team preparing for the first real NFL season,
I want **every still-open `deferred-work.md` bullet dispositioned** as Promote / Accept / Park,
so that launch readiness is an explicit inventory—not a launch-risk subset—and only true blockers become sprint-status stories.

**Context:** Epic 9 is `done`. Story **9.4 AC5** triage covered a **launch-risk subset** only. Code review of 9.4 explicitly deferred: “AC5 triage did not disposition every still-open deferred bullet… future planned `deferred-work.md` pass.” Epic 9 retro (2026-08-03) ordered this as the **first** pre-launch story. Kyle: triage pass, **not** fix-everything.

**UX note:** This story is **documentation / planning triage**, not UI implementation. If (and only if) a bullet is **Promoted** into a front-end sprint-status story, that follow-on create-story must consult `_bmad-output/planning-artifacts/ux-design-specification.md`. Do not invent UI under this story.

## Acceptance Criteria

### AC1 — Exhaustive inventory of still-open bullets

**Given** `_bmad-output/implementation-artifacts/deferred-work.md` contains Resolved sections, struck items, a Story 9.4 launch-risk table, and many still-open bullets  
**When** this story completes  
**Then** the triage artifact enumerates **every still-open** (non-struck, non-Resolved) bullet at least once  
**And** Resolved / struck / “Resolved by Story 9.x” items are **skipped** (listed only if needed to prove they were considered)  
**And** the historical “Planned follow-on: Story 3.10” design block is treated as **historical** (3.10 shipped)—not an open bullet—except any remaining weather follow-ups still listed as open elsewhere (e.g. dome display)  
**And** duplicate mentions of the same underlying risk (e.g. email TOCTOU in 6.2 + 6.5 + 9.4 Accept row) may be **aliased** to one disposition row, but each source bullet must be accounted for (alias note OK)

---

### AC2 — Promote / Accept / Park for every open item

**Given** the inventory from AC1  
**When** this story completes  
**Then** each open item (or alias group) has exactly one disposition:

| Disposition | Meaning |
|-------------|---------|
| **Promote** | True launch blocker **not** already owned by an existing sprint-status key → add a new (or attach to existing) sprint-status story **before** season go-live |
| **Accept** | Known risk OK for first real season (≤14 users); keep in deferred-work with **owner + rationale** |
| **Park** | Explicitly post-launch / nice-to-have / future product; **or** already owned by `pre-launch-*` / `post-epic-9-*` / `docs/deployment.md` (**Park (owned)**) |

**And** dispositions reuse Story 9.4 Accept / Park / Park (owned) / Resolved rows **unless new evidence** overturns them  
**And** **Promote count defaults to zero** for *new* code stories—real go-live blockers (Resend domain, Vercel env/cron, inbox smoke, create-account, guided cutover) are **already** sprint-status keys → mark **Park (owned)**, do **not** duplicate  
**And** this story does **not** require implementing fixes for Accept/Park items  
**And** optional tiny ride-along code fixes are **out of scope** unless Kyle explicitly expands scope mid-story

---

### AC3 — Promote path updates sprint-status (only if needed)

**Given** one or more items are dispositioned **Promote**  
**When** this story completes  
**Then** each Promote has a corresponding `sprint-status.yaml` key (new or clearly attached to an existing pre-launch / post-epic-9 key) with a one-line comment stating the deferred-work source  
**And** if **zero** Promotes are warranted, AC3 is satisfied by documenting “No new Promote keys — blockers already owned” in the triage section / Completion Notes  
**And** do **not** create Epic 10 or reopen `epic-9`

---

### AC4 — Update `deferred-work.md` as the acceptance artifact

**Given** Story 9.4 already added a **Launch-risk triage** table near the top of `deferred-work.md`  
**When** this story completes  
**Then** replace or extend that section with a **Full pre-launch triage (Story pre-launch-deferred-work-full-triage — YYYY-MM-DD)** that:

1. States scope: **every** still-open bullet (extends 9.4 subset)
2. Includes the disposition table(s) with Owner / rationale
3. Marks the 9.4 review finding (“AC5 triage did not disposition every still-open deferred bullet”) as **Resolved by this story**
4. Keeps forensic detail for Accept/Park items (do not delete history)

**And** prefer editing `deferred-work.md` in place (same pattern as 9.4)—no mandatory companion doc  
**And** optional short summary in Completion Notes linking any new sprint-status keys

---

### AC5 — UX / product guardrails for FE-related bullets

**Given** open deferred bullets include UX polish (PickStatusBanner desktop inline, standings sidebar, Snackbar vs Alert, `generateMetadata`, dome weather, scroll-padding, etc.)  
**When** dispositioning those items  
**Then** treat UX-spec **MVP Critical** as already shipped unless the bullet is a true regression of a shipped MVP surface  
**And** treat responsive enhancements / preferred patterns (desktop banner inline layout, standings sidebar, Snackbar polish, tab titles) as **Park** or **Accept**—not Promote—per UX + Story 6.6 deferred notes  
**And** dome/misleading-weather accuracy remains **Park** pending product decision (not a pick-flow blocker)  
**And** if any FE item is somehow Promoted, record “follow-on create-story must load `ux-design-specification.md`” in the Promote row

---

### AC6 — Verify / no false “fixed everything”

**Given** triage is complete  
**When** claiming done  
**Then** `deferred-work.md` full-triage section exists and is internally consistent (no open bullet left without disposition or alias)  
**And** `sprint-status.yaml` `pre-launch-deferred-work-full-triage` can move to `done` only after AC1–AC5  
**And** Completion Notes explicitly state Promote count (including zero) and confirm **no** claim that all deferred bugs were fixed  
**And** `npm test` is **not** required unless code was changed (docs-only → skip)

## Tasks / Subtasks

- [x] Task 1 — Inventory (AC: #1)
  - [x] Read **entire** `deferred-work.md` top to bottom (do not skim)
  - [x] List still-open bullets; skip Resolved/struck; note 9.4 table aliases
  - [x] Treat Story 3.10 design block as historical; keep dome / weather follow-ups if still open elsewhere
- [x] Task 2 — Disposition pass (AC: #2, #5)
  - [x] For each open item/group: Promote / Accept / Park (+ Park owned)
  - [x] Preserve 9.4 Accept/Park unless overturned with evidence
  - [x] Default: **0 new Promotes**; map High-risk ops to existing `post-epic-9-*` / `pre-launch-*`
  - [x] Apply UX guardrails for FE polish bullets (AC5)
  - [x] Owner = Kyle for Accept/Park unless another owner is already named
- [x] Task 3 — Sprint-status Promotes (AC: #3)
  - [x] If Promote > 0: add/attach keys in `sprint-status.yaml`
  - [x] If Promote = 0: document in triage + Completion Notes
- [x] Task 4 — Write triage into deferred-work.md (AC: #4)
  - [x] Add/replace **Full pre-launch triage** section
  - [x] Strike/resolve 9.4 “incomplete AC5 triage” review bullet
  - [x] Keep forensic history intact
- [x] Task 5 — Closeout (AC: #6)
  - [x] Completion Notes: Promote count, owned Park pointers, “triage ≠ fix-all”
  - [x] Run `npm test` only if code changed

### Review Findings

- [x] [Review][Patch] Expand truncated `post-epic-9-vercel…` sprint keys to full `post-epic-9-vercel-production-env-and-cron` [`deferred-work.md:49`]
- [x] [Review][Patch] Split composite **Resolved (9.7) / Park** password-reset row into two single-disposition rows (AC2) [`deferred-work.md:50`]
- [x] [Review][Patch] Reword inventory-check claim — drop “bullets above” / self-certified absolute; state §§A–C + §B aliases cover still-open forensic bullets [`deferred-work.md:273`]
- [x] [Review][Patch] Mark Story 3.10 design-block `- **` bullets as historical (not open deferrals) per AC1 [`deferred-work.md:409-422`]
- [x] [Review][Patch] Clarify picks-lock forensic bullet — strike shipped 3.5 lock-guard; leave `force=true` Park only [`deferred-work.md:396`]
- [x] [Review][Patch] Align story UX table `generateMetadata` to **Park** (triage is Park; drop “Accept / Park”) [`pre-launch-deferred-work-full-triage.md`]
- [x] [Review][Patch] Mark suggested disposition draft as superseded by `deferred-work.md` triage; fix 9.4 AC5 meta row to Resolved-by-this-story [`pre-launch-deferred-work-full-triage.md`]

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| Exhaustive Promote/Accept/Park of every open deferred bullet | Fixing every deferred bug |
| Extension of Story 9.4 AC5 (full file, not launch-risk subset) | Re-running Lighthouse / breaker drills |
| Sprint-status updates **only** for true new Promotes | Epic 10 / reopening Epic 9 |
| Docs artifact in `deferred-work.md` | UI redesign or email HTML changes |
| Guardrail that FE Promotes must later consult UX spec | Implementing UX polish here |

### Locked decisions (do not re-litigate)

1. **Triage ≠ rewrite the world** — dispositions with owners; code only if Kyle expands scope.
2. **Already-owned ops stay Park (owned)** — never re-Promote as mystery work:
   - `post-epic-9-vercel-production-env-and-cron` — env, cron, AUTH_URL, apex/www cookies, external monitor
   - `post-epic-9-resend-domain-and-from-address` — SPF/DKIM, `RESEND_FROM`, optional DMARC
   - `post-epic-9-production-smoke-test` — real inbox + optional Resend message IDs
   - `pre-launch-create-account-flow` — login create-account (product gap; not a deferred-work bullet today)
   - `pre-launch-guided-cutover-runbook` — first-time deployer walkthrough
3. **9.4 Accept rows stay Accept** unless new evidence: Hobby ±1 hr drift; breaker failed/skip conflation; circuit-open skip count; email TOCTOU.
4. **Observability post-launch stays Park** — NFR46 scoring/deadline structured logs per `docs/observability-scope-decision.md`.
5. **MVP scale ≤14 users** — N+1 / over-fetch / weather cache → Park, not Promote.
6. **CSV formula-injection** — PRD requires export as fail-safe (FR55–57), **not** formula sanitization; admin-trusted → **Accept** unless Kyle elevates to security Promote.
7. **Email-as-display-name PII** — spec-mandated private-league pattern → **Accept** (not Promote for GDPR theater).

### Suggested disposition draft — **SUPERSEDED**

> **Canonical dispositions live in** `_bmad-output/implementation-artifacts/deferred-work.md` → **Full pre-launch triage (2026-08-03)**. Tables below were the pre-implementation checklist only; do not re-triage from this draft.

**Already dispositioned in 9.4 — carry forward** *(historical draft)*

| Item | Disposition |
|------|-------------|
| Hobby ±1 hr negative-drift | **Accept** (Kyle) |
| Breaker `failed` conflates errors vs skips | **Accept** (Kyle) |
| Circuit-open logs omit skip count | **Accept** (Kyle) |
| Email TOCTOU / duplicate send | **Accept** (Kyle; Resend 24h + 7.4 AC8 OOS) |
| External uptime monitor | **Park (owned)** → `post-epic-9-vercel-production-env-and-cron` |
| NFR46 scoring/deadline logs | **Park** |
| N+1 sync/score, `allSeasonPicks` | **Park** |
| Weather cache TTL / eviction | **Park** |
| Resend domain / from / DMARC / Auth cookie host | **Park (owned)** → post-epic-9 keys |
| Password-reset token cleanup | **Park** |
| UI polish / Lighthouse / NFR5 / breaker e2e | **Resolved** (skip) |

**Still-open clusters — suggested** *(historical draft)*

| Cluster | Suggested | Notes |
|---------|-----------|-------|
| 9.7 email Head/MSO/PrimaryCta/empty jailed/multipart | Accept ×4; Park multipart MIME | Outlook VML / multipart post-launch |
| 9.6 mobile scroll-padding; 9.5 pathname league fallback | Accept | Not launch blockers |
| 9.4 incomplete AC5 triage meta-bullet | **Resolved by this story** | Process closeout (struck in deferred-work.md) |
| 9.1 isolation mock reimplements filter | Accept | AC where-clause already asserted |
| Epic 8 rehearsal/cleanup/TOCTOU/UX ambiguity | Accept (majority); Park runbook recovery + route tests + `readJsonObject` extract | Single-admin MVP |
| Fixture+real week mix / odds `some` collision | Accept | Documented MVP risk |
| 7.1 CSV formula-injection | Accept | Admin-trusted; no PRD formula NFR |
| 7.1 bulk CSV audit log | Park | Post-launch observability |
| 7.1 export UX / auth envelope / dup constants / filename tests | Accept | |
| pre-epic-7 smoke: Resend message IDs | Park (owned) → `post-epic-9-production-smoke-test` | |
| Invite accept coverage / concurrent accept | Accept | |
| 7.2 `toLocaleString` / over-redact `@` | Accept | |
| 7.4 mapWithConcurrency edge cases | Accept | Unreachable today |
| 6.1 placeholder `from` / invitation from | Park (owned) → Resend post-epic-9 | High risk but **owned** |
| 6.1 `server-only` / empty to-token guards | Accept | |
| 6.2 force resend after 24h; 6.3 sentAt desync / stale outstanding / getReminderData order | Accept | Same class as 9.4 Accepts |
| 6.3 inactive membership filter | Park | Needs membership lifecycle |
| 6.4 auth/callbackUrl/hash/open-redirect tests | Accept | |
| 6.5 cron timing side-channel / ICU toLocaleString | Accept | |
| 6.6 PickStatusBanner desktop inline; standings sidebar | Park | UX enhancement, not MVP gate |
| 6.6 Snackbar; WeatherBadge extract; outstanding refresh | Accept | Banner existence already MVP |
| 6.6 `generateMetadata` / tab titles | **Park** | Private auth app; SEO out of MVP |
| Epic 5 scoring CHECK constraints / playoffs max week | Park | |
| Epic 5 races, string enums, notFound→login, lint debt, counter footgun | Accept | |
| Epic 4 admin races, audit pagination, RESTRICT FK, PII in audit names | Accept; Park FK/index until member-removal | |
| Epic 3 jailed txn/force, route tests, dome weather, logo JSON, schedule N upserts | Accept; Park dome (product), force=true, route tests, per-stage audit | |
| 3.10 SoFi classification / weather script / flake timers | Accept | |

**Expected Promote count:** `0` new keys. If the implementing agent discovers a true unowned launch blocker, Promote it—do not invent work for hygiene.

### Architecture / project-context compliance

- Secrets stay server-only; triage must not invent `NEXT_PUBLIC_*` secrets. [Source: `docs/project-context.md`]
- Observability MVP = hybrid logs + admin email status; no new APM vendor. [Source: `docs/observability-scope-decision.md`]
- Production cutover order remains web → email → smoke. [Source: `docs/domain-provider-decision.md`, epic-9-retro]
- Canonical deploy checklist: `docs/deployment.md` — do not fork a second checklist into deferred-work.

### Previous story intelligence

**From Story 9.4 (done):**
- Triage deliverable pattern: table at top of `deferred-work.md` with Promote/Accept/Park + owner.
- Review finding explicitly left “full deferred pass” for later — **this story is that pass**.
- Do not soften ACs; evidence and dispositions are first-class artifacts.

**From Epic 9 retro (2026-08-03):**
- Execute order: this triage → create-account → guided cutover → post-epic-9 vercel → Resend → smoke.
- Soft carryovers become hard blockers only when promoted to sprint-status.
- deferred-work stays forensic; only promoted items become code stories.

**From Epic 8/9 process habits:**
- Is/Is-NOT + Reuse tables in stories.
- Promote deferred → stories; strike when resolved.
- Do not claim go-live until post-epic-9 smoke passes.

### Git intelligence (recent)

- `7c8d807` docs(retro): complete Epic 9 retrospective and pre-launch backlog
- `8638073` feat(email): Story 9.7 email HTML + CTA polish
- `536f0bb` feat(ui): Story 9.6 hub/links/glow/roof
- Pattern: launch work is tracked as explicit sprint-status keys; docs/triage stories ship markdown as acceptance.

### UX (consulted — no FE implementation)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]

| Deferred-looking item | UX stance | Triage bias |
|-----------------------|-----------|-------------|
| PickStatusBanner | Phase 1 MVP Critical (persistent confirmation) | **Existence = shipped**; desktop inline-with-title = enhancement → Park |
| Standings desktop sidebar | Desktop enhancement; mobile table-only | Park |
| Snackbar for admin actions | Preferred; inline Alert acceptable MVP | Accept |
| WeatherBadge / Dome | Strategic context, not pick-blocking | Park product accuracy (dome) |
| `generateMetadata` / SEO | Private auth app; SEO out of MVP | **Park** |

### Testing requirements

- Docs-only: **no** `npm test` mandate.
- If any code changes sneak in: colocated Vitest + `npm test` per project-context.

### Project Structure Notes

| Artifact | Path |
|----------|------|
| Deferred forensic log + triage table | `_bmad-output/implementation-artifacts/deferred-work.md` |
| Sprint keys | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Deploy checklist | `docs/deployment.md` |
| Observability MVP decision | `docs/observability-scope-decision.md` |
| Epic 9 retro (ordering) | `_bmad-output/implementation-artifacts/epic-9-retro-2026-08-03.md` |
| Prior triage pattern | `_bmad-output/implementation-artifacts/9-4-epic-7-carryovers-lighthouse-nfr5-circuit-breaker-e2e.md` (AC5) |

### Anti-patterns (will fail review)

| Anti-pattern | Why it fails |
|--------------|--------------|
| Only re-triaging the 9.4 launch-risk subset | AC1 requires every open bullet |
| “Promote” by rewriting code inside this story without a sprint key | Promote = tracking story, not silent fix |
| Re-creating Resend/Vercel/smoke as new mystery stories | Already owned — use Park (owned) |
| Deleting forensic deferred history | Keep detail; add disposition |
| Claiming season go-live after triage alone | Go-live still gated on create-account + cutover + post-epic-9 |
| Implementing PickStatusBanner layout / standings sidebar “while we’re here” | Out of scope; violates AC5 |

### References

- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — pre-launch + post-epic-9 keys]
- [Source: `_bmad-output/implementation-artifacts/epic-9-retro-2026-08-03.md` — execution order; triage ≠ fix-all]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — full open inventory + 9.4 subset table]
- [Source: `_bmad-output/implementation-artifacts/9-4-epic-7-carryovers-lighthouse-nfr5-circuit-breaker-e2e.md` — AC5 pattern + review deferral]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR32–34 email; NFR45–47 observability; FR55–57 CSV; NFR9–15 auth]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — MVP vs enhancement for banner/sidebar/Snackbar/weather]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — observability; Vercel]
- [Source: `docs/project-context.md` — non-negotiables; Epic 9 / post-epic-9 pointers]
- [Source: `docs/deployment.md` — production checklist]
- [Source: `docs/observability-scope-decision.md` — post-launch NFR46 scoring/deadline]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Read full `deferred-work.md` (~450→680 lines after triage insert) top-to-bottom; cross-checked open bullets via script against disposition tables.
- Confirmed NFR32 webhook route exists (`src/app/api/webhooks/resend/route.ts`) — already struck as Owned/Resolved by 7.2.
- Struck previously-resolved-but-unstruck forensic rows: password-reset plaintext CTA (9.7), global fixture cleanup (8.7), `isOddsAutomationRequest` extract (5.3).

### Completion Notes List

- **Promote count: 0.** No new sprint-status keys. AC3 satisfied by documenting “No new Promote keys — blockers already owned.”
- **Park (owned) pointers:** `post-epic-9-vercel-production-env-and-cron` (uptime monitor, AUTH cookie/apex-www, env/cron); `post-epic-9-resend-domain-and-from-address` (placeholder `from`, DMARC); `post-epic-9-production-smoke-test` (Resend message IDs); cutover checklist → `docs/deployment.md`. Pre-launch create-account + guided cutover remain separate backlog keys (not deferred-work bullets).
- **9.4 Accept rows preserved** (Hobby drift, breaker failed/skip, circuit-open skip count, email TOCTOU) — no overturning evidence.
- **UX guardrails (AC5):** PickStatusBanner desktop inline + standings sidebar → Park; Snackbar → Accept; dome weather → Park (product); `generateMetadata` → Park.
- **Process closeout:** 9.4 “incomplete AC5 triage” review bullet struck → Resolved by this story.
- **Triage ≠ fix-all:** No application code changed; Accept/Park items intentionally not fixed. `npm test` skipped (docs-only).

### File List

- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/pre-launch-deferred-work-full-triage.md`

### Change Log

- 2026-08-03: Story context created (create-story) — status ready-for-dev. Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-08-03: Full pre-launch triage complete — exhaustive Promote/Accept/Park of every still-open deferred-work bullet; Promote=0; 9.4 AC5 incompleteness finding resolved; status → review.
- 2026-08-03: Code review — 7 doc patches applied (sprint-key ellipsis, AC2 password-reset split, inventory claim, 3.10 historical markers, picks-lock strike, generateMetadata/draft alignment); status → done.
