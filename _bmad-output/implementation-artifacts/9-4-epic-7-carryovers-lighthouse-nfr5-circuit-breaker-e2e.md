# Story 9.4: Epic 7 carryovers — Lighthouse, NFR5, circuit-breaker e2e

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the team preparing for production,
I want the **open Epic 7 measurement and failure-path drills** completed,
so that performance budgets and email outage behavior are evidenced—not only unit-tested.

**Launch-hardening context:** Epic 7 shipped the breaker + `logEvent` `durationMs` wiring but accepted Known Exceptions for authenticated picks/standings Lighthouse and pick-submit NFR5. Epic 8 Story 8.5 was supposed to prove `EMAIL_CIRCUIT_OPEN` under simulated outage; **suppress mode bypasses Resend and the breaker entirely**, so the drill never ran. Epic 8 retro promoted all three gaps here. Kyle also asked to **address `deferred-work.md` before moving on**—this story owns that triage.

**UX note:** This story is **measurement / reliability evidence**, not UI redesign. No front-end visual polish. Existing picks/standings `loading.tsx` skeletons (Story 7.4) and UX loading guidance remain as-is; Story **9.5** owns navigation loading polish.

## Acceptance Criteria

### AC1 — Authenticated Lighthouse for picks + standings

**Given** a rehearsal (or stable authenticated) fixture exists and `docs/performance-budgets.md` currently has real Lighthouse numbers only for `/login`  
**When** this story completes  
**Then** authenticated Lighthouse **Performance** runs (mobile + desktop, same method as the budgets doc) are recorded for:

1. `/leagues/<leagueId>/picks`
2. `/leagues/<leagueId>/standings`

**And** results update the budgets table / detail sections (LCP, TTI at minimum; score/FCP/TBT/SI preferred to match login table)  
**And** either:

- numbers meet **NFR1** (LCP ≤ 3s) and **NFR3** (TTI ≤ 4s) on warm local `npm run start`, **or**
- Known Exceptions are **explicitly re-accepted** with owner + rationale (do not silently leave “unmeasured”)

**And** the “Authenticated picks/standings Lighthouse accepted as unmeasured” Known Exception row is struck or rewritten to reflect the new evidence  
**And** unauthenticated redirects to `/login` remain **invalid** as picks/standings evidence

---

### AC2 — Real pick-submit NFR5 `durationMs` sample

**Given** `logEvent` already emits `action: "pick_submit"` + `context.durationMs` on `POST /api/leagues/[leagueId]/picks`  
**And** the budgets doc still shows pick submit as “not captured” because seed leagues were `SEASON_NOT_READY`  
**When** this story completes  
**Then** at least **one successful** pick-submit sample (full save path, not early `SEASON_NOT_READY` / validation reject) is recorded in `docs/performance-budgets.md` NFR5 table with `durationMs`  
**And** the measurement method stays: server boundary via `logEvent` (excludes client WAN) — **NFR5**  
**And** cold Neon/Vercel first-hit may still exceed 1s (already documented); warm sample should be the primary budget judgment  
**And** the “Pick-submit NFR5 sample accepted as unmeasured” Known Exception is struck or rewritten

---

### AC3 — Circuit-breaker e2e drill proves `EMAIL_CIRCUIT_OPEN` aborts remaining sends

**Given** unit tests already cover threshold math in `src/lib/email/circuit-breaker.ts`  
**And** Story 8.5 suppress path **must not** be used as the drill (it never calls Resend / never touches the breaker)  
**When** this story completes  
**Then** a **scripted or documented** drill proves:

1. After **N = 3** consecutive provider failures (`EMAIL_CIRCUIT_FAILURE_THRESHOLD`), the circuit opens
2. A stable `logEvent` uses `code: "EMAIL_CIRCUIT_OPEN"` (constant `EMAIL_CIRCUIT_OPEN_CODE`)
3. **Remaining** members (and, for multi-league cron, remaining leagues) in that invocation are **aborted** / counted failed without further Resend calls

**Preferred implementation (scripted):** extend Vitest coverage around `sendTuesdayDigest` and/or `sendReminder` (reuse mock patterns in `send-tuesday-digest.test.ts` / `send-reminder.test.ts`) with Resend mocked to always fail, **≥4 members**, production-like path (`isTestLeague: false` **or** test league with `TEST_LEAGUE_EMAIL_MODE=send` — never `suppress`). Assert: Resend call count stops after open, `EMAIL_CIRCUIT_OPEN` logged, unreached members appear in `failed`. Optionally assert shared breaker across two leagues in a thin cron-orchestration test.

**Allowed alternative (documented manual):** ops runbook steps: invalid/revoked `RESEND_API_KEY`, non-suppress league with ≥4 members, trigger admin send or cron with `CRON_SECRET`, capture log lines + HTTP 500 when `failed > 0`. Record date + outcome in Completion Notes and link from `docs/performance-budgets.md` or `docs/observability-ops-runbook.md`.

**And** do **not** add Playwright unless the team explicitly chooses it—architecture still marks `e2e/` optional; AC allows scripted Vitest or documented drill  
**And** Epic 8 deferred “circuit-breaker e2e” entry is struck as **Resolved by Story 9.4**

---

### AC4 — Strike Epic 7 / 8 deferred measurement entries

**Given** `deferred-work.md` already marks the three promoted items as ~~struck~~ → Promoted to Story 9.4  
**When** this story completes  
**Then** update those three entries to **Resolved by Story 9.4** (keep forensic detail; note where evidence lives: budgets doc + drill/tests)  
**And** do the same for any parallel mentions in Epic 7/8 retros only if you touch those files (optional; retros may stay historical)

---

### AC5 — `deferred-work.md` launch-risk triage (Kyle: “Address deferred-work.md before moving on?”)

**Given** `deferred-work.md` still has many open bullets (perf, TOCTOU, polish, post-launch observability)  
**When** this story completes  
**Then** add a short **Launch-risk triage** section (top of `deferred-work.md` or `docs/` companion linked from deferred-work) that classifies remaining **open** items into exactly one of:

| Disposition | Meaning |
|-------------|---------|
| **Promote** | Create/attach a sprint-status story (or fold into an existing Epic 9 / post-epic-9 item) |
| **Accept** | Keep deferred with **owner + rationale** (safe for first real season) |
| **Park** | Explicitly post-launch / nice-to-have; not launch-blocking |

**And** every item the triage considers **launch-risk** must land in Promote or Accept (not silently ignored)  
**And** items already owned by Stories **9.5–9.7** or `post-epic-9-*` should be marked as such (not re-promoted as new mystery work)  
**And** this story does **not** require fixing all deferred bugs—triage is the deliverable; optional low-cost fixes that improve the breaker drill (e.g. separate skip counter) are allowed if scoped tightly

**Suggested launch-risk candidates to explicitly disposition (not an exhaustive mandate to fix):**

| Item | Likely disposition |
|------|--------------------|
| Hobby ±1 hr negative-drift silent-skip | **Accept** — AdminWeeklyEmailStatus + manual send + monitor docs already mitigate; confirm owner Kyle |
| Circuit-breaker `failed` conflates real errors vs aborted skips | **Accept** or tiny **Promote-into-9.4** fix if doing AC3 anyway |
| Circuit-open logs omit skipped-member count | Same as above |
| Email TOCTOU / duplicate send (cron + admin) | **Accept** — Resend 24h idempotency backstop; 7.4 AC8 out of scope |
| External uptime monitor not configured in prod | **Park → post-epic-9-vercel…** / deployment checklist (ops) |
| NFR46 scoring/deadline structured logs | **Park** — post-launch per observability decision |
| N+1 sync/score, `allSeasonPicks` over-fetch | **Park** — MVP ≤14 users; revisit if timeouts |
| Weather cache failure TTL / eviction | **Park** — fail-soft UX |
| UI polish (hub, links, home, email HTML) | Already **9.5–9.7** |
| Resend domain / `from` / DMARC / Auth cookie host | Already **9.2 + post-epic-9-*** |
| Password-reset CTA plaintext / token cleanup | **9.7** / ops park |

## Tasks / Subtasks

- [x] Task 1 — Authenticated Lighthouse picks + standings (AC: #1)
  - [x] Ensure fixture: seeded or rehearsal league with initialized season; sign in as `dev@example.com` / `devpassword123` (or equivalent)
  - [x] Capture session cookie for Lighthouse CLI (Chrome user-data-dir after manual login, or documented cookie jar). Unauthenticated runs are invalid.
  - [x] `npm run build` && `npm run start -- -p 3010` (match budgets doc)
  - [x] Run Lighthouse **12.8.2** performance category, mobile + desktop, against picks and standings URLs
  - [x] Update `docs/performance-budgets.md` tables + Known Exceptions
- [x] Task 2 — Pick-submit NFR5 sample (AC: #2)
  - [x] Use rehearsal/test league with submittable week (Epic 8 path) — not a `SEASON_NOT_READY` seed league
  - [x] Submit a pick against local `start` (or `dev`); grep logs for `"action":"pick_submit"` + `durationMs` on success path
  - [x] Record sample(s) in NFR5 table; note cold vs warm if relevant
  - [x] Strike/rewrite pick-submit unmeasured Known Exception
- [x] Task 3 — Circuit-breaker drill (AC: #3)
  - [x] Prefer Vitest: mock Resend always-fail; ≥4 members; assert open + abort + `EMAIL_CIRCUIT_OPEN`; never use suppress path
  - [x] Optional: thin multi-league shared-breaker assertion mirroring cron route behavior
  - [ ] Optional documented manual drill in ops runbook if Vitest alone feels insufficient for “e2e” — skipped; Vitest drill sufficient (AC3)
  - [x] Do **not** introduce Playwright unless explicitly chosen
- [x] Task 4 — Deferred-work closeout for the three promoted items (AC: #4)
  - [x] Update Epic 7/8 promoted bullets → **Resolved by Story 9.4** with pointers to budgets doc + tests/drill
- [x] Task 5 — Launch-risk triage of remaining deferred-work (AC: #5)
  - [x] Walk open bullets; produce triage table with Promote / Accept / Park + owner/rationale
  - [x] Promote only if truly launch-blocking and not already covered by 9.5–9.7 / post-epic-9
  - [ ] Optional ride-along: separate breaker-skip counter / log skipped count if cheap during Task 3 — deferred via triage Accept
- [x] Task 6 — Verify
  - [x] `npm test` green if code/tests changed
  - [x] Budgets doc + deferred-work triage committed as acceptance artifacts

### Review Findings

- [x] [Review][Defer] AC5 triage scope — expand disposition to every still-open deferred bullet (CSV formula-injection, bulk-export audit log, `sentAt` upsert desync, etc.) — deferred: future planned `deferred-work.md` pass
- [x] [Review][Patch] Circuit drill `lessThan(memberCount)` can flake under concurrency — fixed: memberCount > concurrency+(threshold-1); assert call ceiling [`src/lib/email/send-tuesday-digest.test.ts`]
- [x] [Review][Patch] Outage drill does not pin open threshold to N=3 — fixed: assert `breaker.consecutiveFailures` + log context [`src/lib/email/send-tuesday-digest.test.ts`]
- [x] [Review][Patch] Email TOCTOU Accept row missing owner — fixed: Owner Kyle [`deferred-work.md`]
- [x] [Review][Patch] Optional skip-counter Task 5 subtask over-checked — unchecked; deferred via triage Accept
- [x] [Review][Patch] Optional manual ops drill Task 3 subtask over-checked — unchecked; Vitest drill sufficient

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| Close Epic 7 measurement Known Exceptions with evidence | New performance architecture / CDN / RUM product |
| Prove breaker abort path beyond unit threshold tests | Reworking suppress mode (8.5 stays; drill must avoid it) |
| Triage `deferred-work.md` launch risk | Fixing every deferred bullet |
| Update `docs/performance-budgets.md` | Story 9.5–9.7 UI / email HTML polish |
| Scripted Vitest and/or documented drill | Mandatory Playwright harness |
| Ops evidence for first real season | post-epic-9 Vercel/Resend/inbox smoke execution |

### Locked decisions (do not re-litigate)

1. **Measurement method stays** the one in `docs/performance-budgets.md` (Lighthouse 12.8.2, local `start` port 3010, simulated throttling) unless you document a deliberate change.
2. **NFR5** = server/UI boundary via `logEvent` `durationMs` — not full client RTT.
3. **Breaker threshold N = 3** — `EMAIL_CIRCUIT_FAILURE_THRESHOLD`; code `EMAIL_CIRCUIT_OPEN`.
4. **Suppress mode cannot prove the drill** — `getTestLeagueEmailMode() === "suppress"` short-circuits before Resend/breaker.
5. **No new observability vendor** — Vercel/local JSON logs + existing admin card.
6. **Triage ≠ rewrite the world** — Promote / Accept / Park with owners; code fixes only when cheap or truly launch-blocking.

### Architecture compliance

- Stack: Next.js App Router, Vitest colocated tests, structured `logEvent` — [Source: `docs/project-context.md`, architecture Observability]
- Cron: `maxDuration = 300`, HTTP **500** when `failed > 0`, shared breaker per cron invocation (7.4 review fix) — do not regress
- Secrets: never put `RESEND_API_KEY` / `CRON_SECRET` in client or `NEXT_PUBLIC_*`
- `e2e/` Playwright remains optional — AC explicitly allows scripted or documented drill

### Existing code to reuse (do not reinvent)

| Concern | Path |
|---------|------|
| Budgets + Known Exceptions | `docs/performance-budgets.md` |
| Breaker helper | `src/lib/email/circuit-breaker.ts` + `.test.ts` |
| Digest / reminder send loops | `src/lib/email/send-tuesday-digest.ts`, `send-reminder.ts` |
| Suppress gate (avoid for drill) | `getTestLeagueEmailMode()` + `isTestLeague` branch at top of senders |
| Cron shared breaker | `src/app/api/cron/tuesday-email/route.ts` (and wed/thu) |
| Pick submit timing | `src/app/api/leagues/[leagueId]/picks/route.ts` — `startedAt`, `logPickSubmitRejected`, success `logEvent` |
| Login timing (already sampled) | `src/lib/auth.ts` `authorize` |
| Logging | `src/lib/logging/log-event.ts` |
| Deployment / monitor setup | `docs/deployment.md` — External uptime monitor |
| Ops runbook | `docs/observability-ops-runbook.md` |
| Story 7.4 ACs / exceptions | `_bmad-output/implementation-artifacts/7-4-performance-and-deployment-hardening.md` |

### How to get a real pick-submit sample

1. Rehearsal league with season initialized + current week submittable (Epic 8 controls), **or** any non-pre-season league.
2. Authenticated `POST /api/leagues/<id>/picks` with valid body (UI pick submit is fine).
3. Grep process logs for `"action":"pick_submit"` and `"durationMs"` on **success** (`message: "pick submit completed"`).
4. Rejects (`SEASON_NOT_READY`, validation) are **not** NFR5 budget evidence for the save path.

### How to run authenticated Lighthouse

Budgets doc already states: sign in, then Lighthouse against picks/standings. Practical approaches:

1. Manual: Chrome logged-in → DevTools Lighthouse (record numbers into the doc), **or**
2. CLI: persist Chrome profile / cookie after login, pass `--chrome-flags` / cookie header so the picks URL does not 302 to login.

Unauthenticated CLI hits that land on `/login` are **invalid**.

### Circuit-breaker drill anti-patterns

| Anti-pattern | Why it fails AC3 |
|--------------|------------------|
| Test league + `TEST_LEAGUE_EMAIL_MODE=suppress` | Never calls Resend; breaker unused |
| Only re-running `circuit-breaker.test.ts` | Threshold unit tests already exist; not an invocation drill |
| Single-member league | Cannot prove “abort remaining” after 3 failures |
| Fresh breaker per league in cron | Regresses 7.4 shared-breaker fix — do not reintroduce |

### Previous story intelligence (9.3)

- Prefer Resend + existing helpers; document in deployment notes when touching email.
- Rate-limit / auth stories leave careful logging (no secrets in logs).
- Deferred from 9.3 (plaintext URL in reset email, token cleanup) belong to **9.7** / ops park—not this story’s code scope.
- Keep story ACs hard; do not soften measurement into “we tried.”

### Git intelligence (recent)

- `6ae7f18` feat(auth): Story 9.3 forgot-password
- `040822b` docs: Story 9.2 domain decision
- `9a1ffd8` feat(scoring): Story 9.1 league-scoped scoreNflWeek
- Pattern: Epic 9 stories close launch blockers with docs + tests; measurement stories ship **evidence in docs** as first-class artifacts.

### UX (consulted — minimal FE)

[Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]

- Loading: progress indicators / subtle refresh — already partially satisfied by 7.4 skeletons; **9.5** owns better navigation loading.
- No UX screens for Lighthouse or circuit drills.
- Do not change picks/standings visual design under this story.

### Testing requirements

- If Task 3 adds/extends Vitest: colocated next to send helpers / breaker; run **`npm test`**.
- No mandate for Playwright.
- Measurement artifacts (`docs/performance-budgets.md`) are part of acceptance—treat like code.

### Project Structure Notes

- Docs updates live under `docs/` (budgets, optionally ops runbook).
- Deferred triage lives in `_bmad-output/implementation-artifacts/deferred-work.md` (or a linked short doc).
- Do not invent `scripts/lighthouse.sh` unless it clearly helps reproducibility; ad-hoc `npx lighthouse@12.8.2` matching the budgets doc is enough.
- No package.json e2e script required.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.4 ACs]
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR1–NFR3, NFR5, NFR8, NFR19–NFR21]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability; optional `e2e/`; Vercel]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — loading indicators (no FE redesign here)]
- [Source: `docs/project-context.md` — testing; secrets; Epic 9 carryovers]
- [Source: `docs/performance-budgets.md` — method, login numbers, Known Exceptions]
- [Source: `docs/deployment.md` — external monitor]
- [Source: `docs/observability-ops-runbook.md` — EMAIL_CIRCUIT_OPEN]
- [Source: `_bmad-output/implementation-artifacts/7-4-performance-and-deployment-hardening.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — promoted 9.4 items + launch-risk candidates]
- [Source: `_bmad-output/implementation-artifacts/9-3-forgot-password-flow.md` — prior Epic 9 patterns]
- [Source: `src/lib/email/circuit-breaker.ts`, `send-tuesday-digest.ts`, `send-reminder.ts`]
- [Source: `src/app/api/leagues/[leagueId]/picks/route.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Local `npm run start -- -p 3010` log: pick submit success `durationMs` 453 / 425; origin mismatch when using `127.0.0.1` vs `localhost` for CSRF Origin check (use matching host).
- Lighthouse summary: `/tmp/lh-out/summary.json` (ephemeral lab output).

### Completion Notes List

- **AC1:** Authenticated Lighthouse 12.8.2 mobile+desktop for Willy League picks + standings; final URLs not `/login`. Desktop LCP/TTI meet NFR1/NFR3; mobile TTI meets NFR3; mobile LCP slightly over (3.39s / 3.01s) — re-accepted Known Exception owner Kyle.
- **AC2:** Success-path pick submit samples 453ms / 425ms recorded in budgets doc; unmeasured exception struck.
- **AC3:** Vitest outage drill in `send-tuesday-digest.test.ts` (always-fail Resend, 6 members production path, shared breaker across leagues); ops runbook notes Story 9.4 drill. No Playwright. Skip-counter ride-along deferred as Accept in triage.
- **AC4/AC5:** Three promoted deferred items → Resolved by 9.4; launch-risk triage table added at top of `deferred-work.md`.
- **Incidental:** Fixed TS nullability on `DELETE /api/leagues/[leagueId]` (`league!.isTestLeague`) so `npm run build` succeeds for lab measurement.

### File List

- `src/lib/email/send-tuesday-digest.test.ts`
- `src/app/api/leagues/[leagueId]/route.ts`
- `docs/performance-budgets.md`
- `docs/observability-ops-runbook.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-4-epic-7-carryovers-lighthouse-nfr5-circuit-breaker-e2e.md`

### Change Log

- 2026-07-28: Story context created (create-story) — status ready-for-dev. Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-07-28: Implemented Story 9.4 — authenticated Lighthouse + NFR5 samples, circuit-breaker Vitest drill, deferred-work triage; status → review.
- 2026-07-28: Code review — batch-fixed drill flake/threshold asserts, TOCTOU owner, task checkbox accuracy; status → done.
