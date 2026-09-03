# Deferred Work

Items surfaced during code review that are intentionally deferred. Each entry cites the source review and links back to the story spec.

## Deferred from: spec-pre-week-1-deadline-anchored-reminders.md (2026-09-03)

- **`get-weekly-email-status.ts` still infers reminder status from fixed Wed/Thu Eastern windows** — Rule C moved automated sends onto deadline-anchored daily ticks, but the admin "Email automation status" card still labels rows Wednesday/Thursday reminder and uses `isInEasternWindow` to decide pending vs missed. Cosmetic only; `wednesdayReminderSentAt` / `thursdayReminderSentAt` stamps remain correct. Relabel and re-gate when the admin card is next touched.
- **Empty-outstanding ticks keep calling `sendReminder`** — stamps are written only when `sent > 0` so a nobody-outstanding slot 1 can fall through to slot 2. After slot 1 is due, daily ticks therefore re-enter `sendReminder` (no Resend, `sentAt` stays null) until a send succeeds or the deadline passes. Harmless extra work/logs; tighten if cron duration becomes an issue.

## Deferred from: review of spec-floating-pick-submit-button.md (2026-08-09)

- **`currentPick` / week prop sync into draft+saved** — `WeekMatchupList` still initializes local state once (same as pre-FAB `selection`). Soft client updates without remount could leave draft/saved stale; week navigation usually remounts via RSC. Add a reset effect if client-side week switching without remount appears.
- **`isLocked` never clears once set** — Deadline ticker only sets locked `true`; pre-existing. Harmless for normal Thursday lock; revisit if sim/admin can reopen a week in-session.
- **Component tests for FAB wire-up** — Spec covers pure `isPickDraftDirty`; no RTL coverage for select-then-confirm. Add if regressions show up in the picks client flow.

## Deferred from: review of spec-show-hide-password-toggle.md (2026-08-09)

- **Invite signup password field toggle** — `signup/[token]/signup-form.tsx` still uses a plain password `TextField`. Out of clarified scope (login / create-account / reset-password); reuse `PasswordTextField` when polishing invite signup UX.

## Deferred from: quick-dev split of spec-profile-picture-uploads.md (2026-08-09)

Split to keep the core Profile upload + nav avatar shippable. Also tracked under Priority Items in local `PRIORITIES.md`.

- ~~**Profile picture thumbnails on in-app list surfaces**~~ — Shipped in `spec-profile-picture-list-thumbnails.md` (2026-08-09).
- **Profile picture thumbnails in Tuesday digest email standings** — Absolute Blob URLs as small thumbs left of names in `TuesdayDigestEmail` standings rows (+ digest data/preview wiring).

## Deferred from: review of spec-profile-picture-list-thumbnails.md (2026-08-09)

- **Avatar session `update()` soft failures** — Profile only surfaces an error when `update()` throws; a resolve-without-throw soft failure could leave nav stale without the new alert. Watch in prod; add retry/assert on session image if reported.
- **Roster `imageUrl` loader unit coverage** — `list-league-roster.test.ts` still covers sort only; mapping is covered by TypeScript + hub UI wiring.

## Deferred from: review of spec-profile-picture-uploads.md (2026-08-09)

- **Concurrent avatar replace races** — Overlapping POSTs can leave intermediate Blob objects undeleted (last write wins on `User.image`). Acceptable for Hobby; add compare-and-swap / in-flight guard if abuse appears.
- **EXIF orientation on crop** — Phone photos may crop/save rotated; no orientation normalization in the canvas path.
- **Image decode / pixel bomb limits** — Server sniffs magic bytes and enforces 5MB but does not decode/re-encode with dimension caps (e.g. sharp).
- **Avatar rate-limit pre-auth IP burn** — Same proxy pattern as other mutators; unauthenticated clients can consume the IP bucket before auth.

## Deferred from: review of spec-color-mode-toggle.md (2026-08-09)

- **Root layout Prisma colorMode lookup on every request** — `resolveInitialColorMode` calls `auth()` + `user.findUnique` so DB wins over a stale JWT after login write-through. Future: prefer JWT `colorMode` when fresh and only hit DB on mismatch / post-update, or cache the preference without making the whole tree dynamic-heavy.
- **API/route-level tests for color-mode PATCH** — Helpers cover parse/Zod; CSRF + auth write-through paths untested at the route layer. Add if regression risk rises.

## Deferred from: review of spec-off-season-reminder-email-gate.md (2026-08-08)

- **No colocated cron route tests for `skippedPreview`** — Helper + `get*Data` cover preview eligibility; Tue/Wed/Thu cron early-continue paths are untested at the route layer. Add if regression risk rises.

## Deferred from: review of spec-hybrid-canonical-live-league-sim-schedule.md

- **Non-atomic sim odds snapshot + jailed persist** — `applySimulationOddsSnapshot` writes the completed sim odds run, then calls `computeAndPersistLeagueWeekJailed` in a separate step (pre-existing global snapshot + jailed pattern). A mid-flight failure can leave odds without a matching jailed row until retry.
- **Duplicated jailed persist logic between global and league paths** — `computeAndPersistNflWeekJailed` and `computeAndPersistLeagueWeekJailed` share resolution/audit shape but diverge on deadline gating and table targets; drift risk if one path is hardened without the other.

## Deferred from: quick-dev split of Option B hybrid schedule (2026-08-04)

Split from implementing research `technical-league-scoped-vs-canonical-nfl-schedule-research-2026-08-04.md` Option B. Hybrid isolation (`spec-hybrid-canonical-live-league-sim-schedule.md`) and follow-ons below.

- ~~**Cron auto-sync Odds schedule/results**~~ — **Resolved** (`spec-cron-odds-schedule-results-auto-sync.md`): `/api/cron/sync-nfl-schedule` + `/api/cron/sync-nfl-results` → canonical `NflGame` only; admin sync remains override.
- ~~**Full-volume simulation fixtures**~~ — **Resolved** (`spec-full-volume-simulation-fixtures.md`): fixture JSON ≥6 weeks × 13–16 games/week; `buildFixtureKickoffTimes` emits pairwise-distinct ET slots for N≤16.

## Deferred from: review of spec-cron-odds-schedule-results-auto-sync.md (2026-08-04)

- **TNF / early-week scores vs Wed-only results cron** — Odds `/scores` `daysFrom=3` + single Wednesday cron can miss Thursday Night Football (and similar) before lookback slides; ops uses admin `sync-results` today. Consider a Sat UTC backup results cron on a free Hobby day if auto-coverage is required.
- **`getCurrentNflSeasonYear` UTC calendar default** — Pre-existing; cron + admin share MVP UTC year (or `NFL_SEASON_YEAR` env). January playoff weeks can target the wrong label year until Eastern league-year logic lands.
- **Concurrent admin + cron schedule sync** — No locking between cron and admin override; both call the same sync libs. Acceptable for Hobby; add an in-flight guard if overlapping runs appear in prod.

## Deferred from: review of spec-live-display-odds-picks.md (2026-08-03)

- **Multi-instance in-memory TTL** — `src/lib/nfl/live-display-odds.ts` cache is per process (same pattern as weather). Each Vercel instance / cold start can spend ~2 Odds API credits on cache miss. Acceptable for Hobby MVP; shared cache later if quota pressure appears.
- **No HTTP timeout on live odds fetch** — Provider call can delay picks SSR until platform timeout. Same gap as Tuesday snapshot / weather clients; add `AbortSignal` timeout if TTFB regressions show up in prod.
- **Post-season “current week” still overlays** — After the last kickoff, `resolveActiveWeekNumber` stays on the final week so live display may keep calling the provider. Low urgency; gate on season state if credits become an issue.

## Deferred from: review of spec-user-first-last-name-profile.md (2026-08-03)

- **Deleted-user `/profile` bounce** — Valid JWT with missing User row redirects to login with `callbackUrl=/profile`; rare data-integrity edge. Sign-out-on-missing-user if it appears in prod.
- **Invite signup a11y helper wiring** — Create-account name fields use richer `aria-describedby` than invite signup; invite still shows field errors. Align when polishing invite UX.
- **Authenticated `EMAIL_IN_USE` enumeration** — Profile returns distinct 409 for taken emails to signed-in users. Acceptable for MVP; soften message if privacy becomes a concern.
- **Other devices keep stale JWT email after Profile email change** — Inherent to JWT sessions until expiry/re-login; out of scope for immediate-save Profile.

## Deferred from: adversarial review of spec-league-rules-user-facing-copy.md (2026-08-03)

- **Rules page omits “one pick per week”** — Pre-existing gap vs a complete participant rulebook; not introduced by the user-facing copy rewrite. Add if participants still ask after launch.
- **Rules page omits whether the jailed team itself is pickable** — Prior copy vaguely mentioned “validation”; rewrite did not add a clear allowed/blocked rule. Confirm product wording and add when ready.
- **Rules page omits ties / postponements / no-contests scoring** — Pre-existing edge-case gaps (0 points for NFL ties is domain policy elsewhere). Out of scope for this copy pass.

## Deferred from: code review of 9-7-email-html-layout-polish.md (2026-07-31)

- **EmailLayout missing `<Head>` charset/viewport** — React Email templates omit an explicit `<Head>`; common client meta is left to defaults. Not required by 9.7 ACs; revisit if Outlook/mobile encoding issues appear in real inbox smoke.
- **Container `borderRadius` without MSO/VML Outlook fallback** — Rounded white card corners will not render in Outlook desktop. Acceptable for MVP polish; VML button/card chrome is heavy for this story.
- **PrimaryCta empty/whitespace `href` guard** — Shared CTA does not guard blank hrefs; send helpers always pass constructed absolute URLs. Harden if a caller can pass empty strings.
- **Jailed team empty-string (vs null) label edge** — Templates treat null as “not set” but empty strings can still render a blank/awkward jailed label. Pre-existing data-contract edge; not introduced by layout polish.
- **Multipart `text/plain` MIME alongside HTML** — Send paths still HTML-only with inline “Or paste this link” fallback (AC3). True `text/plain` alternative parts remain out of scope for 9.7.

## Deferred from: code review of 9-6-league-hub-and-picks-interaction-polish.md (2026-07-31)

- **Mobile top chrome scroll-padding only desktop** — `scrollMarginTop` / `scrollPaddingTop` apply at `md+` only for the fixed desktop AppBar; small viewports still rely on bottom nav / `xs: 0`. Not introduced as a new product requirement in 9.6.

## Deferred from: code review of 9-5-app-shell-home-nav-scroll-breakpoints-loading.md (2026-07-29)

- **Pathname league-id fallback retained for SSR/hydration** — Dropping `parseLeagueIdFromPathname` fallback in `LeagueNavShell` would avoid league tabs on true 404 URLs, but causes missing tabs in SSR HTML vs client. Reserved-segment guard (`new`) shipped instead; revisit if 404 chrome becomes a real issue.

## Full pre-launch triage (Story pre-launch-deferred-work-full-triage — 2026-08-03)

**Scope:** Every still-open (non-struck, non-Resolved) bullet in this file. Extends Story 9.4’s launch-risk **subset** to an exhaustive inventory. Disposition is exactly one of **Promote** / **Accept** / **Park** / **Park (owned)**. Owner = **Kyle** unless noted.

**Promote count:** **0** new sprint-status keys. True go-live blockers are already owned by `post-epic-9-*` / `pre-launch-*` / `docs/deployment.md` — marked **Park (owned)**. This story is **triage ≠ fix-all**; Accept/Park items were not implemented here.

**Supersedes:** Launch-risk triage (Story 9.4 — 2026-07-28). 9.4 Accept / Park / Park (owned) / Resolved rows carried forward unchanged (no overturning evidence). Measurement closeouts remain in [`docs/performance-budgets.md`](../../docs/performance-budgets.md); breaker drill in `src/lib/email/send-tuesday-digest.test.ts`.

**Historical (not open):** “Planned follow-on: Story 3.10” design block below is **historical** (3.10 shipped). Struck / “Resolved by Story …” bullets skipped. Pre-production Vercel checklist is canonical in `docs/deployment.md` only.

**Process closeout:** Story 9.4 review finding “AC5 triage did not disposition every still-open deferred bullet” → **Resolved by this story** (see struck bullet under 9.4 deferred section).

### A. Carry-forward from Story 9.4 (unchanged)

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| Authenticated Lighthouse picks/standings | **Resolved (9.4)** | Evidence in performance-budgets.md; mobile LCP Known Exception re-accepted (Kyle) |
| Pick-submit NFR5 `durationMs` sample | **Resolved (9.4)** | Warm success samples 453ms / 425ms in budgets doc |
| Email circuit-breaker e2e under outage | **Resolved (9.4)** | Vitest drill: Resend always-fail, ≥4 members, `EMAIL_CIRCUIT_OPEN`, shared breaker across leagues |
| Hobby ±1 hr negative-drift silent-skip | **Accept** | Kyle — AdminWeeklyEmailStatus + manual send + ops runbook already mitigate. *Also listed under pre-epic-6.* |
| Circuit-breaker `failed` conflates errors vs aborted skips | **Accept** | Kyle — AC allows consistent failed/skipped counting; ops use `EMAIL_CIRCUIT_OPEN` logs. *Source: 7.4 review.* |
| Circuit-open logs omit skipped-member count | **Accept** | Kyle — `remainingAborted: true` + aggregate `failed` sufficient for MVP. *Source: 7.4 review.* |
| Email TOCTOU / duplicate send (cron + admin) | **Accept** | Kyle — Resend 24h idempotency; 7.4 AC8 OOS. *Aliases: 6.2 tuesday-send TOCTOU; 6.5 cron TOCTOU.* |
| External uptime monitor not configured in prod | **Park (owned)** | `post-epic-9-vercel-production-env-and-cron` / `docs/deployment.md` |
| NFR46 scoring/deadline structured logs | **Park** | Post-launch per `docs/observability-scope-decision.md`. *Also listed under pre-epic-7 observability.* |
| N+1 sync/score, `allSeasonPicks` over-fetch | **Park** | MVP ≤14 users. *Aliases: 5.1 sync N+1; Epic 5 retro score N+1; 4.2 `allSeasonPicks`.* |
| Weather cache failure TTL / eviction | **Park** | Fail-soft UX. *Aliases: 7.4 weather failure TTL + no proactive eviction.* |
| UI polish (hub, links, home, loading, email HTML) | **Resolved (9.5–9.7)** | App shell **9.5**, hub/links/glow **9.6**, email HTML **9.7** |
| Resend domain / `from` / DMARC / Auth cookie host | **Resolved** | Auth host: vercel story. Domain/`from`/DMARC: `post-epic-9-resend-domain-and-from-address` (2026-08-03) — `send.nflpickem.cc` verified; Production `RESEND_FROM`; `_dmarc` `p=none`. *Code `DEFAULT_FROM` placeholder left by design (env override).* |
| Password-reset CTA plaintext URL fallback | **Resolved (9.7)** | Plaintext “Or paste this link” fallback shipped in **9.7** |
| Password-reset `password_reset_tokens` retention cleanup | **Park** | Kyle — ops retention if table size becomes an issue (also §C 9.3) |

### B. Alias groups (one disposition; all sources accounted)

| Alias group | Disposition | Source bullets |
|-------------|-------------|----------------|
| Email TOCTOU / duplicate send | **Accept** | 9.4 table; 6.2 concurrent tuesday-send; 6.5 cron read-then-send-then-write |
| Hobby ±1 hr negative-drift | **Accept** | 9.4 table; pre-epic-6 |
| NFR46 scoring/deadline logs | **Park** | 9.4 table; pre-epic-7 observability |
| N+1 / over-fetch at MVP scale | **Park** | 9.4 table; 5.1 sync N+1; Epic 5 retro score N+1; 4.2 `allSeasonPicks` |
| Weather cache TTL / eviction | **Park** | 9.4 table; 7.4 failure-TTL + no eviction |
| Resend `from` / domain / DMARC / Auth host | **Resolved** | vercel story (Auth) + resend-domain story (domain/`from`/DMARC) 2026-08-03 |
| `sentAt` / suppress-branch upsert desync | **Accept** | 6.3 `sentAt` upsert failure; 8.5 suppress-branch upsert no retry |
| `readJsonObject` duplication | **Park** | 5.1 ×2; 8.2; 8.3; 8.4 (fifth copy) — extract when next touched |
| Route-layer integration tests absent | **Park** | 8.1 `TEST_LEAGUES_DISABLED`; 8.2 AC8 inspection-only; 3.4 picks route 201/200 |
| `generateMetadata` / tab titles | **Park** | 5.4 standings; 5.6 results; 6.6 league pages |
| `notFound()` vs sign-in redirect | **Accept** | 5.5 history; 5.6 results — unified auth-redirect middleware later |
| Stale admin outstanding count | **Accept** | 6.3 `outstandingCount`; 6.6 real-time refresh note |

### C. Full disposition by source cluster

#### Epic 9 reviews (still open)

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 9.7 EmailLayout missing `<Head>` charset/viewport | **Accept** | Kyle — not in 9.7 ACs; revisit if inbox smoke shows encoding issues |
| 9.7 Container `borderRadius` without MSO/VML Outlook fallback | **Accept** | Kyle — Outlook desktop chrome OK for MVP |
| 9.7 PrimaryCta empty/whitespace `href` guard | **Accept** | Kyle — callers always pass absolute URLs |
| 9.7 Jailed team empty-string (vs null) label edge | **Accept** | Kyle — pre-existing data-contract edge |
| 9.7 Multipart `text/plain` MIME alongside HTML | **Park** | Kyle — post-launch; AC3 HTML + paste-link fallback ships |
| 9.6 Mobile scroll-padding only at `md+` | **Accept** | Kyle — not a launch blocker; small viewports use bottom nav |
| 9.5 Pathname league-id fallback for SSR/hydration | **Accept** | Kyle — reserved-segment guard shipped; revisit if 404 chrome issues |
| 9.4 AC5 incomplete full deferred pass | **Resolved (this story)** | Exhaustive Promote/Accept/Park below |
| 9.3 `password_reset_tokens` expiry/consumed cleanup | **Park** | Kyle — ops retention if table size becomes an issue |
| 9.2 DMARC omitted from email DNS plan | **Resolved** | `post-epic-9-resend-domain-and-from-address` — `_dmarc` TXT `v=DMARC1; p=none;` |
| 9.2 Auth.js cookie / apex vs www canonical session | **Resolved** | `post-epic-9-vercel-production-env-and-cron` — canonical `www.nflpickem.cc`; apex → www; Production `AUTH_URL` |
| 9.1 Isolation mock reimplements filter in test | **Accept** | Kyle — AC where-clause already asserted; thinner mock later |

#### Epic 8 (rehearsal / simulation)

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 8.7 Per-week jailed cleanup N+1 in txn | **Accept** | Kyle — fine for short rehearsal week sets |
| 8.7 Concurrent last-two test-league deletes skip cleanup | **Accept** | Kyle — single-admin MVP |
| 8.7 Zero–odds-line NflGame rows survive cleanup | **Accept** | Kyle — provenance rule as written; manual ops if observed |
| 8.6 Simulation/email error-recovery omitted from runbook | **Park** | Kyle — happy-path sufficient; expand if operators get stuck |
| 8.5 Rehearsal Eastern-clock status labels cosmetic | **Accept** | Kyle — read-only card; manual send works |
| 8.5 Suppress-branch upsert no error handling | **Accept** | Kyle — same class as 6.3 `sentAt` desync (aliased) |
| 8.5 Config lookup before `providedBreaker.open` short-circuit | **Accept** | Kyle — AC3-mandated ordering; not independently fixable |
| 8.5 AdminEmailComposer note TextField not disabled while saving | **Accept** | Kyle — pre-existing race; single-admin |
| 8.4 Odds-line `some` + natural-key collision | **Accept** | Kyle — documented MVP risk; requires exact matchup coincidence |
| 8.4 `readJsonObject` fifth copy | **Park** | Kyle — aliased extract later |
| 8.4 No colocated tests for `AdminSimulationControls` | **Park** | Kyle — when UI-component test convention exists |
| 8.4 No mid-loop `$transaction` failure test | **Accept** | Kyle — route 500 already handles; low value |
| 8.4 “0 games finalized” alert ambiguity | **Accept** | Kyle — cosmetic; revisit if confusing in practice |
| 8.3 Kickoff-slot duplication if fixture week >4 games | **Resolved** | Kyle — `spec-full-volume-simulation-fixtures.md` |
| 8.3 Raw `Error` on missing team abbr → opaque 500 | **Accept** | Kyle — ops precondition; teams pre-seeded |
| 8.3 Membership/season lookups outside try/catch | **Accept** | Kyle — matches advance-week pattern |
| 8.3 No `homeTeamId === awayTeamId` guard | **Accept** | Kyle — unreachable via validated fixtures |
| 8.3 TOCTOU concurrent apply-odds | **Accept** | Kyle — single-admin; upsert avoids dup rows |
| 8.3 Uncaught jailed-compute throw leaves odds without jailed | **Accept** | Kyle — self-healing on next apply |
| 8.3 Fixture + real schedule mix same `(year, week)` | **Accept** | Kyle — documented MVP risk; partially mitigated at delete (8.7) |
| 8.3/8.2 `readJsonObject` duplication | **Park** | Kyle — aliased |
| 8.2 AC8 production no-op verified by inspection only | **Park** | Kyle — route tests when infra exists |
| 8.1 No route-handler test for `TEST_LEAGUES_DISABLED` | **Park** | Kyle — gate logic unit-covered |

#### Epic 7 / pre-epic-7

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 7.2 `toLocaleString` ET round-trip fragile | **Accept** | Kyle — works on Vercel full-ICU; refactor when cron next touched |
| 7.2 `redactSensitive` over-redacts `@` | **Accept** | Kyle — PII-safety tradeoff for MVP |
| 7.1 CSV formula-injection not sanitized | **Accept** | Kyle — admin-trusted; PRD FR55–57 require export, not formula sanitization |
| 7.1 Anchor download shows raw JSON on API errors | **Accept** | Kyle — spec chose `href` download; UX polish later |
| 7.1 `auth()` outside try/catch on export route | **Accept** | Kyle — matches submission-status pattern |
| 7.1 `REGULAR_SEASON_WEEKS` duplicated | **Accept** | Kyle — low-risk maintainability nit |
| 7.1 No unit tests for `sanitizeDownloadFilenameSegment` | **Accept** | Kyle — simple helper; manual verify OK for MVP |
| 7.1 No audit log for bulk PII CSV export | **Park** | Kyle — post-launch observability |
| pre-epic-7 NFR46 scoring/deadline logs | **Park** | Aliased — post-launch observability decision |
| pre-epic-7 Resend message IDs not captured in smoke | **Resolved** | Kyle — `post-epic-9-production-smoke-test` row 10 dashboard delivery clear; optional per-send message IDs consciously skipped (2026-08-03) |
| pre-epic-7 Thin `acceptLeagueInvitation` coverage | **Accept** | Kyle — membership paths manually smoked |
| pre-epic-7 No unit test `already_registered` preview | **Accept** | Kyle — manual invite flow covered |
| pre-epic-7 Concurrent duplicate accept race | **Accept** | Kyle — 7.4 AC8 OOS; revisit if invite abuse |
| 7.4 Breaker `failed` / skip conflation | **Accept** | Aliased — 9.4 Accept |
| 7.4 Circuit-open omit skip count | **Accept** | Aliased — 9.4 Accept |
| 7.4 Weather cache no eviction / failure TTL | **Park** | Aliased — 9.4 Park |
| 7.4 `mapWithConcurrency` concurrency unvalidated | **Accept** | Kyle — unreachable; only caller passes `4` |
| 7.4 `mapWithConcurrency` uses `Promise.all` not `allSettled` | **Accept** | Kyle — current mappers self-catch |

#### Epic 6 (email / UX)

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 6.1 Placeholder Resend `from` domain | **Resolved** | Production `RESEND_FROM` on verified `send.nflpickem.cc` (2026-08-03) |
| 6.1 Invitation `from` placeholder | **Resolved** | Same — env override; code `DEFAULT_FROM` left as fallback |
| 6.1 No `server-only` on email modules | **Accept** | Kyle — runtime startup guard exists |
| 6.1 Empty `to` / `rawToken` guards | **Accept** | Kyle — API callers validate upstream |
| 6.2 TOCTOU concurrent tuesday-send | **Accept** | Aliased — 9.4 Accept |
| 6.2 `force=true` resend after 24h idempotency expiry | **Accept** | Kyle — admin tool; address if complaints |
| 6.3 Stale `outstandingCount` SSR prop | **Accept** | Kyle — acceptable MVP; polish later |
| 6.3 `sentAt` upsert → response/DB desync | **Accept** | Kyle — same class as 9.4 Accepts |
| 6.3 No inactive/departed membership filter | **Park** | Kyle — needs membership lifecycle model |
| 6.3 `getReminderData` before idempotency guard | **Accept** | Kyle — accepted 409-path cost |
| 6.4 `auth()` without try/catch on login | **Accept** | Kyle — global error-handling later |
| 6.4 `callbackUrl` as `string[]` falls through | **Accept** | Kyle — spec pattern; open-redirect audit later |
| 6.4 No path-traversal/open-redirect negative tests for picks | **Accept** | Kyle — existing `getSafeCallbackPath` coverage; harden later |
| 6.4 URL fragment in `callbackUrl` stripped | **Accept** | Kyle — hash nav not used in app |
| 6.5 Timing side-channel length pre-check in `assertCronRequest` | **Accept** | Kyle — spec-authorized; MVP OK |
| 6.5 Cron TOCTOU idempotency | **Accept** | Aliased — 9.4 Accept |
| 6.5 `toLocaleString` ICU dependency | **Accept** | Kyle — safe on Vercel full-ICU |
| 6.6 PickStatusBanner desktop inline with title | **Park** | Kyle — UX enhancement; banner existence = MVP Critical shipped (AC5) |
| 6.6 Standings desktop sidebar | **Park** | Kyle — desktop enhancement; mobile table-only OK |
| 6.6 Snackbar admin feedback | **Accept** | Kyle — inline Alert acceptable MVP |
| 6.6 `generateMetadata` on league pages | **Park** | Kyle — private auth app; SEO out of MVP (aliased) |
| 6.6 WeatherBadge component extraction | **Accept** | Kyle — cosmetic |
| 6.6 Real-time admin outstanding refresh | **Accept** | Aliased — 6.3 |

#### Epic 5 / pre-epic-5

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 5.1 N+1 in sync transaction | **Park** | Aliased — MVP scale |
| 5.1 Duplicate `readJsonObject` | **Park** | Aliased |
| 5.1 NaN/Infinity not guarded in `getGameWinner` | **Accept** | Kyle — upstream `parseScoreTotal` guards |
| 5.1 `skipped` conflates team-match vs DB-not-found | **Accept** | Kyle — split counters when sync observability matters |
| 5.2 No atomicity CHECK on scoring columns | **Park** | Kyle — schema hardening post-launch |
| 5.2 No range CHECK on `points_earned` | **Park** | Kyle — when scoring rules solidify |
| 5.2 Team in multiple FINAL games map collision | **Accept** | Kyle — data-corruption edge |
| 5.2 FINAL null scores silently `skipped` | **Accept** | Kyle — ops distinguish later |
| 5.2 Read-then-write race in `scoreNflWeek` | **Accept** | Kyle — low risk admin-triggered |
| 5.3 Timing-safe bearer compare | **Accept** | Kyle — broader auth hardening later |
| 5.3 Unconditional `auth()` for automation | **Accept** | Kyle — harmless latency |
| 5.3 No try/catch in finalize-week route | **Accept** | Kyle — global error layer later |
| 5.3 `z.coerce.number()` accepts boolean | **Accept** | Kyle — spec-specified coerce |
| 5.3 Auth header trailing whitespace | **Accept** | Kyle — trim when next touched |
| 5.3 No txn between game-status check and score | **Accept** | Kyle — same race class as 5.2 |
| 5.3 `weekNumber` max 18 excludes playoffs | **Park** | Kyle — raise when playoff scoring in scope |
| 5.3 Non-object JSON body coerced to `{}` | **Accept** | Kyle — cosmetic error message |
| 5.4 Missing `generateMetadata` standings | **Park** | Aliased — title pass |
| 5.4 Outcome string literals vs Prisma enum | **Accept** | Kyle — single enum-import pass later |
| 5.4 Null `user.email` / displayName `localeCompare` | **Accept** | Kyle — email non-null in schema today |
| 5.4 All memberships in standings regardless of role | **Accept** | Kyle — admin is full participant (2.6) |
| 5.5 scoredAt/outcome partial-write display | **Accept** | Kyle — tied to CHECK constraint Park |
| 5.5 `season.findFirst` non-deterministic on dupes | **Accept** | Kyle — schema uniqueness expected |
| 5.5 `notFound()` vs sign-in on history | **Accept** | Aliased |
| 5.5 React key on `nflWeekNumber` | **Accept** | Kyle — unique constraint prevents dupes |
| 5.5 Unhandled Prisma rejections → 500 | **Accept** | Kyle — global error layer later |
| 5.6 `notFound()` vs sign-in on results | **Accept** | Aliased |
| 5.6 Email-as-display-name exposes PII | **Accept** | Kyle — spec-mandated private-league pattern (not GDPR theater) |
| 5.6 No `generateMetadata` results | **Park** | Aliased |
| 5.6 Test mocks do not validate Prisma WHERE | **Accept** | Kyle — integration tests later |
| Epic 5 retro `AdminPickOverrideDialog` lint debt | **Accept** | Kyle — fix when next admin-panel story touches it |
| Epic 5 retro score N+1 in `$transaction` | **Park** | Aliased — MVP ≤14 |
| Epic 5 retro `$transaction` counter double-count footgun | **Accept** | Kyle — pattern note for future stories |
| pre-epic-5 Thursday lock `0` seconds magic | **Accept** | Kyle — extract when file next touched |
| pre-epic-5 No DST-boundary Thursday lock test | **Accept** | Kyle — expand coverage later |
| pre-epic-5 Exported lock constants public API | **Accept** | Kyle — `@internal` if consumers proliferate |
| pre-epic-5 Exact 8:10 kickoff boundary untested | **Accept** | Kyle — broaden `computePickDeadlineUtc` later |
| pre-epic-5 Redundant third test / brittle copy / code name / dup-game determinism | **Accept** | Kyle — test/API hygiene; not launch blockers |
| 4.2 `validateJailedLineupAndBonus` unconditional opponent lookup note | **Accept** | Kyle — main bug fixed in `pre-epic-5-fix-jailed-lineup-bonus-bug`; residual defensive note |

#### Epic 4

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 4.1 Multiple picks same membershipId overwrite | **Accept** | Kyle — DB unique prevents in prod |
| 4.1 Empty string email → blank displayName | **Accept** | Kyle — schema requires non-empty email |
| 4.1 Sequential DB calls on admin page | **Accept** | Kyle — minor latency |
| 4.1 null `weekNumber` passes kickoff filter | **Accept** | Kyle — impossible under current schema |
| 4.2 Concurrent admin submissions last-write-wins | **Accept** | Kyle — single-admin MVP |
| 4.2 `priorSeasonPickCount` before `existing` check | **Accept** | Kyle — negligible; deletes don’t exist |
| 4.2 TOCTOU role check outside transaction | **Accept** | Kyle — pre-existing admin-route pattern |
| 4.2 `allSeasonPicks` over-fetch | **Park** | Aliased — MVP scale |
| 4.3 No pagination on `getAuditLog` | **Accept** | Kyle — add when trails grow |
| 4.3 RESTRICT FK blocks future member-removal | **Park** | Kyle — revisit with member-removal story |
| 4.3 Missing secondary index on `adminMembershipId` | **Park** | Kyle — when “overrides by admin” query built |
| 4.3 Update test asserts same team before/after | **Accept** | Kyle — add distinct before/after case later |
| 4.3 Email fallback in audit names exposes PII | **Accept** | Kyle — admin UI; profile story later |
| 4.3 `adminMembershipId` arg not re-validated to session | **Accept** | Kyle — route always passes DB-fetched id |
| 4.3 `createdAt` typed as `string` in view model | **Accept** | Kyle — serialize at boundary later |
| 4.4 `jailed.randomSeed` vs `audit.randomSeed` not cross-validated | **Accept** | Kyle — FR52 harden later |
| 4.4 Independent `resolvePicksWeekNumber` page vs section | **Accept** | Kyle — thread shared `now` if observable |
| 4.4 No fallback to most recently computed jailed week | **Accept** | Kyle — product ask later |
| 4.4 Legacy rows: no stage chips / no UI hint | **Accept** | Kyle — UX feedback if warranted |
| 4.4 `jailedTeamId` DB vs audit never cross-checked | **Accept** | Kyle — data-consistency layer later |
| 4.4 `.passthrough()` on AuditJsonV1Schema | **Accept** | Kyle — intentional forward-compat |
| 4.4 Optional Zod vs required domain for stage slices | **Accept** | Kyle — monitor new computation paths |

#### Epic 3 (incl. weather / schedule)

| Item | Disposition | Owner / rationale |
|------|-------------|-------------------|
| 3.3 `force=true` + audit for jailed recompute after lock | **Park** | Kyle — optional admin force path |
| 3.3 Transactional jailed compute + row lock | **Accept** | Kyle — low practical risk admin-only |
| 3.3 Per-stage survivors in jailed `audit` | **Park** | Kyle — verifier enhancement |
| 3.4 Concurrent `isCreate` 201/200 race | **Accept** | Kyle — semantic-only; pick data correct |
| 3.4 No route-layer 201/200 / idempotency test | **Park** | Aliased — route tests later |
| 3.6 Domed stadium weather display misleading | **Park** | Kyle — product decision required; not pick-flow blocker (AC5) |
| 3.7 Prisma patch bump + seed session note | **Accept** | Kyle — repo hygiene when convenient |
| 3.5 `GAMES_NOT_LOADED` message for null-`kickoffAt` | **Accept** | Kyle — spec reuses validation |
| 3.5 `checkPickMutationDeadline` null on empty games | **Accept** | Kyle — documented precondition |
| 3.5 `now` not injectable in jailed computation | **Accept** | Kyle — testability refactor later |
| 3.5 Thursday cutoff magic literal note | **Accept** | Kyle — largely addressed by pre-epic-5 constants; residual hygiene |
| 3.5 `gamesWithKickoff` manually reconstructed | **Accept** | Kyle — type-narrowing polish |
| 3.8 `resolveNflLogoSrc` imports full `nfl-teams.json` | **Accept** | Kyle — ~32 teams; MVP OK |
| 3.9 Serial upserts in schedule sync | **Park** | Kyle — admin-only low-frequency; MVP scale |
| 3.9 Overly permissive Zod schemas | **Accept** | Kyle — matches odds-api pattern |
| 3.9 Rename migration noise | **Accept** | Kyle — already applied; no functional change |
| 3.9 Load all 32 teams every sync | **Park** | Kyle — negligible at current scale |
| 3.10 `scripts/test-weather.ts` unhandled rejection | **Accept** | Kyle — dev utility only |
| 3.10 SoFi “retractable” classification accuracy | **Accept** | Kyle — metadata accuracy; related to dome product Park |
| 3.10 Non-deterministic `Date.now()` horizon tests | **Accept** | Kyle — theoretical flake; fake timers if CI noise |

### D. Completeness / skipped

| Category | Treatment |
|----------|-----------|
| Struck / Resolved-by-story bullets | Skipped (e.g. 9.1 blast radius, 8.7 fixture cleanup, 5.3 `isOddsAutomationRequest` extract, 7.4 maxDuration/breaker/Lighthouse/NFR5, 6.6 WCAG/skeletons/landing, NFR32 webhook **Resolved by 7.2**, weather caching **Resolved by 7.4**, password-reset plaintext CTA **Resolved by 9.7**, “Resolved by Story 9.6/9.7” summary sections, etc.) |
| Planned follow-on Story 3.10 design block | **Historical** — 3.10 shipped; open weather follow-ups are dome (Park) + SoFi classification (Accept) above |
| Pre-production Vercel checklist section | **Park (owned)** → `docs/deployment.md` + `post-epic-9-*` keys (not open code bullets) |
| Epic 8 retro “Tracking note” | Informational only (sprint-status ownership) — not an open defect |
| `pre-launch-create-account-flow` / `pre-launch-guided-cutover-runbook` | Create-account done; guided cutover runbook story + private runbook exist — cutover **execution** remains `post-epic-9-*` (order per epic-9 retro) |

**Inventory check:** Disposition tables in §§A–C (with §B alias groups) cover every still-open forensic bullet in this file; Resolved / struck / historical design notes are skipped per §D. **Promote = 0** — no new `sprint-status.yaml` keys added.

## Resolved by Story 9.7 (2026-07-31)

- **Email HTML layout polish** — Shared `EmailLayout` + `email-styles` (light canvas, brand header); all four member-facing templates restyled.
- **Primary CTA emphasis** — Emerald `#2ECC71` primary button with padding / 16px bold label on digest, reminder, invite, and password-reset.
- **Plaintext URL fallback** — “Or paste this link: …” under every primary CTA (including password reset).
- **Digest CTA hierarchy** — “Make your picks” moved above optional commissioner note.

## Resolved by Story 9.6 (2026-07-29)

- **League hub visual pop + contained CTAs** — `LeagueHubQuickActions` elevated Paper hub block; season summary folded into hub; Picks/Standings/Results as `contained` buttons.
- **App-wide link color + underline** — `create-app-theme.ts` `MuiLink` defaults + `MuiCssBaseline` bare `<a>` styles; auth back-links no longer force `text.secondary`.
- **Per-pick green glow hover** — `MatchupCard` individual team-side glow; whole-card hover removed; selected side visible without hover.
- **Retractable roof hidden without weather** — `shouldShowRetractableWeatherChrome` helper + unit tests; dome Indoor chip unchanged.

---

## Deferred from: code review of 9-4-epic-7-carryovers-lighthouse-nfr5-circuit-breaker-e2e.md (2026-07-28)

- ~~**AC5 triage did not disposition every still-open deferred bullet**~~ — **Resolved by Story pre-launch-deferred-work-full-triage (2026-08-03)** — exhaustive Promote/Accept/Park of every still-open bullet in the Full pre-launch triage section above.

## Deferred from: code review of 9-3-forgot-password-flow.md (2026-07-28)

- ~~**Password-reset email has Button CTA only (no plaintext URL fallback)**~~ — **Resolved (9.7)** — plaintext “Or paste this link” fallback on reset + all primary CTAs.
- **No expiry/consumed cleanup for `password_reset_tokens`** — table grows with superseded/expired rows; no cron or retention job in 9.3. Add ops cleanup if table size becomes an issue.

## Deferred from: code review of 9-2-domain-provider-investigation.md (2026-07-28)

- ~~**DMARC omitted from email DNS plan**~~ — **Resolved** (`post-epic-9-resend-domain-and-from-address`, 2026-08-03): `_dmarc.nflpickem.cc` TXT `v=DMARC1; p=none;` published after SPF/DKIM verify.
- ~~**Auth.js cookie / apex vs www canonical session guidance**~~ — **Resolved** (`post-epic-9-vercel-production-env-and-cron`, 2026-08-03): Production canonical host `https://www.nflpickem.cc`; apex redirects to www; `AUTH_URL` matches; login verified on www.

## Deferred from: code review of 9-1-league-scoped-scoring-scorenflweek-blast-radius.md (2026-07-28)

- **Cross-league isolation test reimplements filter in mock** — `src/lib/scoring/score-nfl-week.test.ts` blast-radius case mocks `pick.findMany` to filter by `where.season.leagueId`, so it mostly proves “update what findMany returned.” AC3.1/AC3.2 where-clause asserts and AC3.3’s “score layer” wording are already satisfied; strengthen later with a thinner mock or orchestration-level two-league test if desired.

## Deferred from: code review of 8-7-delete-test-league-and-data-cleanup.md (2026-07-28)

- **Per-week jailed cleanup N+1 inside transaction** — `cleanupOrphanTestFixtureData` loops affected weeks with per-week `nflGame.count` + conditional `nflWeekJailedTeam.deleteMany` inside `$transaction`. Fine for short rehearsal week sets; batch/optimize later if cleanup latency or lock duration becomes an issue.
- **Concurrent last-two test-league deletes can both skip cleanup** — Two parallel DELETEs of the final two test leagues can each observe `remainingTestLeagueCount > 0` and both skip `cleanupOrphanTestFixtureData`, leaving global fixtures with zero test leagues. Accepted for MVP (single-admin rehearsal); harden with serialized delete+count if multi-admin concurrent delete becomes real.
- **Zero–odds-line NflGame rows survive cleanup** — AC2 fixture-only detection requires exclusive `test_fixture` odds-line provenance; games with zero odds lines (e.g. partial 8.3 failure) are never deleted. Accepted as written provenance rule; ops can clean orphans manually if observed.

## Deferred from: code review of 8-6-rehearsal-runbook-for-invited-participants (2026-07-28)

- **Simulation/email error-recovery paths omitted from rehearsal runbook** — `docs/rehearsal-runbook.md` documents the happy-path week loop only. Edge cases not covered: apply-results before odds (`SIMULATION_GAMES_NOT_LOADED`), advance without results (pointer-only), Tuesday `ALREADY_SENT` / force resend, email UI before mark-ready, missing season (`SEASON_NOT_FOUND`), delete API non-OK. AC1–AC5 do not require failure/recovery docs; revisit if rehearsal operators get stuck in practice.

## Deferred from: story 8-5-email-and-scheduled-jobs-in-rehearsal (2026-07-27)

- **`get-weekly-email-status.ts` real-Eastern-clock status inference is cosmetically wrong for rehearsal leagues** — `src/lib/admin/get-weekly-email-status.ts` infers `pending` / `not_sent` / `skipped` using real Eastern wall-clock day/hour (`isOnOrAfterEasternDayHour`), not the simulated week clock. For a rehearsal league viewed on a real Saturday, the admin dashboard card may show misleading labels even though manual send buttons work correctly (AC1 fixes week targeting; this card is read-only display only). Not cited by Story 8.5 ACs; revisit if reported as confusing in practice.

## Deferred from: code review of 8-5-email-and-scheduled-jobs-in-rehearsal (2026-07-28)

- **Suppress-branch `LeagueWeekEmailConfig` upsert has no error handling/retry** — `src/lib/email/send-tuesday-digest.ts` and `src/lib/email/send-reminder.ts`'s new suppress branches call `prisma.leagueWeekEmailConfig.upsert` unwrapped; a transient DB failure throws uncaught instead of being retried or reflected in the returned result shape. Same class as the already-accepted 6.3 deferred item ("sentAt DB upsert failure causes response/DB desync"), now also present in the suppress branch.
- **`sendTuesdayDigest`'s config lookup runs before the `providedBreaker.open` short-circuit** — `src/lib/email/send-tuesday-digest.ts:47-58` now performs a `leagueWeekEmailConfig.findUnique` (for `adminNote`) before checking whether a shared circuit breaker passed from a multi-league cron run is already open, adding a DB dependency during an already-open circuit that didn't previously exist. Required by AC3's mandated ordering (suppress check must run before the breaker check); not independently fixable without contradicting the story's own spec.
- **`AdminEmailComposer`'s note `TextField` isn't disabled during `saving`/`sending`** — `src/components/admin/AdminEmailComposer.tsx:201-210`; editing the note while a save/send is in flight can have in-flight keystrokes overwritten by the save response. Pre-existing race, not introduced by this story.

## Deferred from: code review of 8-4-simulated-game-results-and-scoring-reveal-cycle (2026-07-20)

- ~~**Cross-league scoring blast radius via unscoped `scoreNflWeek`**~~ — **Resolved by Story 9.1** (Epic 8 retrospective 2026-07-28 — launch blocker). Forensic detail retained: `applySimulationWeekResults` → `finalizeNflWeek` → `scoreNflWeek` was not league-scoped; `scoreNflWeek`'s `Pick` query (`src/lib/scoring/score-nfl-week.ts`) filtered only by `nflWeekNumber` + `season.nflSeasonYear`. AC2 provenance guards `NflGame` writes, not cross-league `Pick` scoring. **Fix:** optional `leagueId` on `scoreNflWeek` / `finalizeNflWeek` (production admin path omits it); required `leagueId` on `applySimulationWeekResults` and the simulation apply-results route.
- **Odds-line `some` filter can match a game that later becomes real via natural-key collision** — `NflGame`'s natural key is `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` with real `Team` FKs. If a rehearsal fixture's matchup for a week exactly coincides with the real schedule's matchup for that week, Story 3.9's upsert-by-natural-key sync attaches a real-sourced odds line to the same row that already carries a `test_fixture` line (rather than creating a new row), and AC2's `some`-based candidate filter would still select it for fake-score finalization. Requires exact matchup coincidence (not just the same week), so lower probability than the fixture+real-mix risk below, but the same underlying class — documented here as a sharper sub-case of that entry.
- **`readJsonObject` duplicated a fifth time** — `src/app/api/leagues/[leagueId]/simulation/apply-results/route.ts` copies the same helper again (see 8.1–8.3 / 5.1 deferred notes). Still not extracted; acceptable per existing convention.
- **No colocated test file for `AdminSimulationControls.tsx`** — the component has zero tests despite now housing three distinct fetch-driven handlers with their own error branches. Pre-existing gap (the first two buttons were also untested before this story); revisit if/when a UI-component testing convention is established for this codebase.
- **No test for `$transaction` failing mid-loop in `applySimulationWeekResults`** — `src/lib/nfl/apply-simulation-week-results.ts:36-53`. A thrown error partway through the per-game update loop propagates to the route's catch-all (500 `INTERNAL_ERROR`), which is reasonable existing behavior; just not directly asserted by a test. Low value add given the route-level fallback already handles it.
- **"0 games finalized, 0 picks scored" success alert doesn't distinguish "already fully scored" from "week not fully finalized yet"** — `src/components/admin/AdminSimulationControls.tsx:181-183`. Cosmetic extension of the already-accepted fixture+real mixed-week risk (see 8.3 entry below); revisit only if this ambiguity is reported as confusing in practice.

## Deferred from: code review of 8-3-simulated-odds-and-jailed-team-for-rehearsal (2026-07-20)

- ~~**Kickoff-slot duplication if a fixture week ever exceeds 4 games**~~ — **Resolved** (`spec-full-volume-simulation-fixtures.md`): `buildFixtureKickoffTimes` now builds 16 distinct Thu/Sun/Mon ET slots (minute staggers in early/late Sunday windows); fixture weeks are 13–16 games.
- **Raw untyped `Error` on missing team abbreviation surfaces as opaque `INTERNAL_ERROR`** — `src/lib/nfl/apply-simulation-odds-snapshot.ts:144-149`. `ensureFixtureGamesForWeek` throws a plain `Error` (not the module's own `{ ok: false, code, message, httpStatus }` shape) if a fixture abbreviation isn't found in `Team`, which the route's generic `catch` turns into a 500 `INTERNAL_ERROR` — losing the actionable "seed nfl teams first" message client-side (still visible in server logs via the route's `console.error`). Ops-only precondition failure; teams are pre-seeded per Dev Notes, so low priority.
- **Membership/season lookups run outside the route's `try/catch`** — `src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts:70-121`. A DB error thrown by `prisma.leagueMembership.findUnique` or `resolveCurrentSeasonForLeague` bypasses the `{ error: { code, message } }` envelope used by every other failure path in the function. Matches `advance-week/route.ts`'s (Story 8.2) pre-existing, identical scoping — not a regression introduced by this story; fix both together if a cross-route hardening pass is ever done.
- **No guard against `homeTeamId === awayTeamId` in `deriveFixtureOddsLine`** — `src/lib/domain/derive-fixture-odds-line.ts:32`. A degenerate self-matchup input would silently produce a "valid-looking" odds line. Unreachable via any current call path (fixture JSON structural test forbids a team facing itself within a week; real schedule sync never produces a self-game), so no defensive guard was added — consistent with the codebase's general "trust validated upstream inputs" style (e.g. `jailed.ts`).
- **TOCTOU race: concurrent "apply odds snapshot" calls could both attempt fixture-game creation** — `src/lib/nfl/apply-simulation-odds-snapshot.ts:52-63`. The "read games → if empty, ensure fixture games → re-read" sequence isn't wrapped in a single transaction/lock spanning the whole flow. Two near-simultaneous invocations (fast double-click, or a race against a Story 3.9 real-schedule sync) could both observe zero games and both attempt creation. The story's AC3 explicitly rejects an optimistic-lock guard ("safe to click repeatedly") for *sequential* re-invocation; true concurrent races are a narrower, lower-probability case where the per-row `upsert` should still avoid duplicate rows, but an unhandled Prisma unique-constraint conflict on the natural key would surface as an undocumented 500 rather than an AC3-listed code.
- **Uncaught throw from `computeAndPersistNflWeekJailed` leaves odds rows persisted with no jailed row** — `src/lib/nfl/apply-simulation-odds-snapshot.ts:103-107`. If the jailed-compute call throws (as opposed to its normal `ok: false` path, which AC3 explicitly requires propagating unchanged), the already-written `OddsSnapshotRun`/`NflGameOddsLine` rows for that request are not rolled back and the request surfaces a bare 500. Consistent with the story's documented "self-healing" model (a later successful apply/recompute overwrites); not itself a data-corruption risk, just an inconsistent state until the next successful run.

## Deferred from: story 8-3-simulated-odds-and-jailed-team-for-rehearsal (2026-07-20)

- ~~**Global fixture rows not cleaned by Story 8.7 per-league cascade**~~ — **Resolved by Story 8.7 (2026-07-28):** deleting the last test league runs `cleanupOrphanTestFixtureData` (`src/lib/nfl/cleanup-rehearsal-fixtures.ts`) to remove `test_fixture` snapshot runs, fixture-only games, and orphan jailed rows. While other test leagues remain, shared fixtures are retained.
- **Accepted MVP risk: fixture + real schedule mix for the same `(year, week)`** — If fixture `NflGame` rows are created during rehearsal and Story 3.9 later syncs a different real matchup set for the same week, sync **adds** real games (different natural key) rather than replacing fixtures — the week can then mix fixture and real games. Documented in 8.3 Dev Notes; not solved in this story. **Partially mitigated at delete (Story 8.7):** cleanup keeps games with any non-`test_fixture` odds line; mixed weeks retain real games and jailed rows until manually resolved. **During-rehearsal** mixed-week behavior is unchanged.
- **`readJsonObject` duplicated a fourth time** — `src/app/api/leagues/[leagueId]/simulation/apply-odds-snapshot/route.ts` copies the same helper again (see 8.2 / 5.1 deferred notes). Still not extracted; acceptable per existing convention. **Updated by Story 8.4:** now a fifth copy in `apply-results/route.ts`.

## Deferred from: code review of 8-2-shortened-simulated-season-and-admin-driven-week-advancement (2026-07-19)

- **`readJsonObject` duplicated again** — `src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts` copies the same 8-line body-parsing helper already flagged in the 5.1 review below. Now present in 14+ route files project-wide. Extract to a shared `src/lib/request-utils.ts` when the next route touches this — the case for doing so keeps getting stronger.
- **AC8 points 3 & 4 (production-league no-op guarantees) verified by code inspection only, not by test** — `src/app/api/leagues/[leagueId]/simulation/advance-week/route.ts` (403 `NOT_TEST_LEAGUE`, no DB write) and `src/app/api/leagues/route.ts` (`isTestLeague: false` → persisted `simulationWeekCount` stays `NULL`). Matches confirmed project-wide convention (no `route.ts` has a colocated integration test, per 8.1 review); AC8.3/8.4 verified by code inspection and cross-checked by two independent review layers instead.

## Deferred from: code review of 8-1-test-league-flag-labeling-and-optional-global-gates (2026-07-19)

- **No direct route-handler test for `TEST_LEAGUES_DISABLED` 403** — `src/app/api/leagues/route.ts` lines 112–122. Pre-existing project convention: no `route.ts` file anywhere in the codebase has a colocated integration test; the `isTestLeague` + `ALLOW_TEST_LEAGUES` gate logic itself is fully covered via `allow-test-leagues.test.ts` and `create-league-body.test.ts`. Revisit if/when route-level integration test infrastructure is established (see also the deferred 3.4 note on route-layer testing).

## Deferred from: code review of 7-2-structured-logging-and-admin-visible-health-signals (2026-07-06)

- **`getEasternWallClock` uses `toLocaleString` round-trip** — `src/lib/cron/eastern-window.ts`. Pre-existing fragile ET conversion; new status helpers inherit it. Refactor to `Intl` or `Temporal` when cron/time logic is next touched.
- **`redactSensitive` redacts any string containing `@`** — `src/lib/logging/redact-sensitive.ts`. May over-redact URLs or error text; acceptable MVP tradeoff for PII safety.

## Deferred from: code review of 7-1-admin-csv-export-of-full-league-snapshot (2026-07-06)

- **CSV formula-injection not sanitized** — `src/lib/export/serialize-league-export-csv.ts`. Email or team labels starting with `=`, `+`, `-` could trigger spreadsheet formula execution on open. Not in story AC; consider prefixing or sanitizing in a security pass.
- **Anchor download shows raw JSON on API errors** — `src/components/admin/AdminExportCsvButton.tsx`. Spec explicitly chose `component="a"` + `href` over fetch+blob; error UX improvement deferred unless product revisits download pattern.
- **`auth()` outside try/catch on export route** — Matches existing `submission-status` route pattern; defer consistent auth error envelope to a cross-route hardening pass.
- **`REGULAR_SEASON_WEEKS` duplicated** — Builder and serializer each define `18`; low-risk maintainability nit.
- **No unit tests for `sanitizeDownloadFilenameSegment`** — Simple helper; manual route verification sufficient for MVP.
- **No audit log for bulk PII CSV export** — Observability/audit scope deferred to Stories 7.2 and 7.4. **7.4 stretch skipped** — still optional post-launch; not blocking ACs.

## Deferred from: code review of pre-epic-7-observability-scope-decision (2026-07-05)

- **NFR46 MVP stance covers email only, not scoring/deadline failures** — `docs/observability-scope-decision.md` documents manual ops for email cron windows; PRD NFR46 also lists deadline enforcement and scoring. Explicit out-of-scope table defers scoring/pick-deadline structured logging to post-launch; acceptable for hybrid MVP scope.

## Deferred from: code review of pre-epic-7-manual-email-flow-smoke-test (2026-07-05)

- ~~**AC8 Resend message IDs not captured**~~ — **Resolved** (2026-08-03): production smoke row 10 Resend dashboard delivery clear; optional per-send message IDs consciously skipped (`post-epic-9-production-smoke-test`).
- **Thin unit coverage for `acceptLeagueInvitation`** — Only error-class tests exist; membership upsert and invite consumption paths verified manually during AC3 smoke test.
- **No unit test for `already_registered` signup preview branch** — New preview status branch covered by manual invite flow only.
- **Concurrent duplicate accept requests** — Parallel accept POSTs can race on invite consumption. **Out of scope for 7.4** (AC8); revisit if invite abuse appears.

## Deferred from: code review of 5-1-ingest-game-results-and-finalize-games (2026-06-11)

- **N+1 queries in sync transaction** — `src/lib/nfl/sync-nfl-results.ts`. Per-game `findUnique` + `update` inside a single transaction (up to ~288 calls for a full-season 18-week sync). Correctness is unaffected; risk is transaction timeout on very large syncs. Refactor to batch-fetch all matching `NflGame` rows up front and reduce round-trips when quota or performance becomes a concern.
- **Duplicate `readJsonObject` helper in both route files** — `src/app/api/admin/nfl/sync-results/route.ts` and `src/app/api/admin/nfl/games/[gameId]/result/route.ts`. Same 8-line function copied verbatim. Extract to a shared `src/lib/request-utils.ts` (or similar) when a third admin route needs it.
- **NaN/Infinity not explicitly guarded in `getGameWinner`** — `src/lib/domain/scoring.ts:15`. The `== null` check does not catch `NaN`. Upstream `parseScoreTotal` guards against non-finite values, so runtime risk is low; add an explicit `Number.isFinite` guard if `getGameWinner` gains call sites outside the mapped-results pipeline.
- **`skipped` count conflates team-match failures with DB-not-found** — `src/lib/nfl/sync-nfl-results.ts`. The `skipped` field in the sync response counts both mapping-level errors (unknown team names) and DB-level misses (no matching `NflGame` row). Split into separate counters (`skippedUnknownTeam`, `skippedNotFound`) when sync observability becomes important.

## Deferred from: code review of story 3-3-jailed-team-identification-and-tie-breakers (2026-04-25)

- ~~**Picks-lock guard on jailed POST (done in 3.5)**~~ — **Resolved by Story 3.5** — `computeAndPersistNflWeekJailed` returns **409** `WEEK_PICK_WINDOW_CLOSED` when the pick window is past deadline (schedule + kickoff data present).
- **`force=true` + audit for jailed recompute after lock** — Optional admin force path if recompute is ever required after pick-window lock (Epic 4 / one-line follow-up). **Park** in Full pre-launch triage §C.
- **Transactional read+resolve+upsert for jailed compute** — `src/lib/nfl/jailed-computation.ts`. Wrap `nflGame.findMany` + `getEffectiveOddsLinesForWeek` + `randomBytes` + `prisma.nflWeekJailedTeam.upsert` in a `prisma.$transaction` with row-level locking on `(nflSeasonYear, weekNumber)` so two concurrent admin POSTs cannot generate independent random seeds and silently overwrite each other. Low practical risk on an admin-only endpoint but real once an automation runner exists; needs a refactor of `getEffectiveOddsLinesForWeek` to accept the transaction client.
- **Per-stage survivors in jailed `audit`** — `src/lib/domain/jailed.ts` `buildResult`. Persist `afterMoneyline` and `afterSpread` slices alongside the full `candidates` array so a verifier (Story 4.4 jailed verification view) can see exactly which candidates reached the SPREAD or RANDOM stage without re-running the algorithm in their head.

## Deferred from: code review of 3-4-pick-api-with-server-side-validation (2026-04-26)

- **Concurrent `isCreate` 201/200 status code race** — `src/app/api/leagues/[leagueId]/picks/route.ts` lines 234–244. Under READ COMMITTED, two concurrent first-time POSTs for the same `(leagueMembershipId, seasonId, nflWeekNumber)` both see `existing = null` and both return 201. Pick data is correct (upsert wins); only the status code is wrong for the second caller. Fix requires SERIALIZABLE isolation for the transaction or extracting create/update from upsert side-effects (not directly supported in Prisma). Semantic-only error; low practical risk given single-user pick flow.
- **No route-layer test for 201/200 and idempotency** — `src/app/api/leagues/[leagueId]/picks/route.ts`. The "idempotent repeat of same body → 200" clause in AC1 and the 201-on-create branch are uncovered at the route level. Spec explicitly says "Prisma optional in route tests." Defer to when integration/e2e test infrastructure is established.

## Follow-up for Story 3.5 (from 3.4)

- *(Resolved in 3.5 — see `checkPickMutationDeadline`, `src/lib/domain/pick-deadline.ts`, and jailed `WEEK_PICK_WINDOW_CLOSED`.)*

## Planned follow-on: Story 3.10 — kickoff-time weather forecast (deferred from 3.6, 2026-04-28)

> **Historical (not open):** Story **3.10 shipped**. Design notes below are retained for forensic context only — they are **not** still-open deferred bullets. Remaining weather follow-ups are dispositioned in Full pre-launch triage §C (dome → Park; SoFi classification / script / flake timers → Accept).

**Context:** Story 3.6 ships **current-conditions** weather (`/data/2.5/weather`) — conditions at the moment the picks page loads. This is a useful approximation but not a kickoff-time forecast.

**Goal:** Replace or supplement the current-conditions call with a **point-in-time forecast** for each game's `kickoffAt` at the home team's stadium coordinates.

**Key design decisions resolved in 3.10 (historical):**

- ~~**Provider choice**~~ — must support lat/lon + target datetime. OpenWeatherMap options:
  - `/data/2.5/forecast` (free): 3-hour-step forecasts, up to **5 days out**. Adequate for games within the week; useless for games > 5 days away.
  - One Call API 3.0 (`/data/3.0/onecall`): hourly up to **48 h**, daily up to **8 days**. Free tier requires credit card; 1,000 calls/day free. Better fit for full-week previews.
  - Any other provider returning hourly lat/lon forecast is a drop-in behind `fetchWeatherForTeam`.
- ~~**Fallback window:**~~ When `kickoffAt` is outside the provider's forecast horizon (e.g. week loaded on Monday, game on Sunday +10 days), fail-soft to `null` (no chip) rather than returning stale current conditions — **do not silently show the wrong data**.
- ~~**Dependency on 3.9:**~~ Reliable UTC `kickoffAt` per `NflGame` row is a hard prerequisite. Until 3.9 ships, seed-only Week 1 games have fixed kickoff times — workable for a limited pilot but not for the full 18-week season.

**Interface change is minimal — already isolated:** `fetchWeatherForTeam` in `src/lib/integrations/weather/client.ts` currently ignores the game's time. Signature change to `fetchWeatherForGame(abbreviation: string, kickoffAt: Date): Promise<WeatherData | null>` and updating the one call site in `src/lib/picks/build-league-picks-week-view.ts` is the full surface area.

**No schema change required** — `WeatherData` shape (`tempF`, `condition`, `windMph`) is sufficient; forecast APIs return the same fields in different endpoints.

**Suggested acceptance criteria for 3.10:**
1. Weather chip reflects **forecast conditions at `kickoffAt`**, not page-load time.
2. Games with `kickoffAt` beyond the provider's horizon render **no weather chip** (fail-soft, no crash).
3. `WEATHER_API_KEY` still the only secret; no `NEXT_PUBLIC_*`.
4. `npm test` passes; weather client covered by fixture-based unit test for the forecast path.

**Blocked by:** Story 3.9 (real `kickoffAt` data for all weeks).

---

## Deferred from: code review of 3-6-picks-ui-matchups-odds-spread-weather-optional (2026-04-28)

- ~~**Keyboard/a11y for clickable team selection**~~ — **Resolved by Story 3.7** (radiogroup + keyboard); verified no regression in Story 7.3.
- ~~**Weather caching**~~ — **Resolved by 7.4** — 10-minute in-memory TTL (+ in-flight coalescing) in `src/lib/integrations/weather/client.ts`.
- **Domed stadium weather display** — Weather conditions are fetched and shown for fully-enclosed stadiums (Allegiant/LV, US Bank/MIN, SoFi/LAC+LAR, Lucas Oil/IND, Ford Field/DET, NRG/HOU). Showing temperature and wind for a climate-controlled game is misleading. Add a `dome: true` flag to `NFL_STADIUM_BY_TEAM_ABBR` and skip weather fetch for dome stadiums. Product decision required before implementing.

## Deferred from: code review of 3-7-jailed-and-already-picked-ux-with-countdown-and-status (2026-05-09)

- **Prisma patch-level bump + seed session note** — `package.json` / `package-lock.json` move `@prisma/client` and `prisma` from 7.7.x to 7.8.x; `prisma/seed.cjs` adds a console reminder to re-auth after migrate reset. Unrelated to 3.7 acceptance criteria; treat as repo hygiene when convenient.
- ~~**44×44 touch target for anti-jailed “2 PTS” chip**~~ — **Resolved by Story 7.3** — `MatchupCard` anti-jailed chip `minWidth`/`minHeight` ≥44.

## Deferred from: code review of 3-5-deadline-enforcement-server-authority (2026-04-26)

- **`GAMES_NOT_LOADED` message misleading for null-`kickoffAt` case** — `src/app/api/leagues/[leagueId]/picks/route.ts`. When games exist but one has a null kickoff, the message says "No game schedule data is available" — implying no ingestion occurred. A distinct message or code for the partial-ingestion case would be clearer, but the spec sanctions reusing this validation.
- **`checkPickMutationDeadline` returns null for empty games — latent bypass** — `src/lib/picks/assert-pick-mutation-allowed.ts`. The documented precondition ("call only after games are loaded") prevents this in practice, but any future caller that omits the route-level guard silently bypasses deadline enforcement. Consider an invariant throw on empty input.
- **`now` not injectable in `computeAndPersistNflWeekJailed`** — `src/lib/nfl/jailed-computation.ts`. The jailed recompute path captures `now` internally, making the deadline check path difficult to unit test deterministically. Align with `checkPickMutationDeadline`'s injected `now` pattern in a future refactor.
- **Thursday 8:10 PM cutoff is a magic literal, not a named constant** — `src/lib/domain/pick-deadline.ts`. The `20, 10` hour/minute values in `lockByThursdayDefaultUtc` and the associated test assertions are scattered. A named export (`THURSDAY_LOCK_HOUR`, `THURSDAY_LOCK_MINUTE`) would create a single authoritative source.
- **`gamesWithKickoff` manually reconstructed rather than type-narrowed** — `src/app/api/leagues/[leagueId]/picks/route.ts`. The loop that rebuilds each game as `{ homeTeamId, awayTeamId, kickoffAt }` sheds future Prisma fields. A type-narrowing filter (`.filter((g): g is ... => g.kickoffAt != null)`) avoids the parallel allocation.

## Deferred from: code review of 3-8-nfl-team-logos-discovery-and-implementation.md (2026-05-10)

- **`resolveNflLogoSrc` imports full `nfl-teams.json` into the client bundle** via `TeamLogo` — file is small (~32 teams); acceptable MVP tradeoff. Optional follow-up: codegen or a static uppercase `Set` so the client never imports full JSON metadata.

## Deferred from: code review of 3-9-nfl-schedule-provider-spike-and-sync.md (2026-05-23)

- ~~**Serial `for-await` upserts inside `$transaction`** (`src/lib/nfl/sync-nfl-schedule.ts`)~~ — **Moot** (API-Sports sync retired; Odds sync has its own path).
- ~~**Overly permissive Zod schemas** (`src/lib/integrations/api-sports-nfl/schemas.ts`)~~ — **Moot** (package deleted in spec-retire-api-sports).
- **Rename migration adds noise** (`prisma/migrations/20260511022811_2026_first_games_migration/migration.sql`) — only truncates an index name to fit Postgres identifier limits; already applied to DB; no functional change.
- ~~**All 32 teams loaded from DB on every sync call** (`src/lib/nfl/sync-nfl-schedule.ts`)~~ — **Moot** (API-Sports sync retired).

## Deferred from: code review of 3-10-kickoff-time-weather-forecast (2026-05-24)

- **`scripts/test-weather.ts` unhandled promise rejection** — `main()` is called without `.catch()`; an uncaught rejection will silently exit with a non-zero code. Dev utility only; add `.catch(console.error)` if the script sees repeated use.
- **SoFi Stadium (LAC/LAR) "retractable" classification** — The roof is a fixed translucent canopy with open sides rather than a true retractable mechanism. Whether weather "applies" is debatable. Revisit stadium metadata accuracy when the roof feature is formally specced.
- **Non-deterministic `Date.now()` in horizon tests** — Tests compute future offsets from live `Date.now()`, creating a theoretical flake at the 5-day boundary window. Replace with `vi.useFakeTimers()` if this becomes a CI reliability concern.

## Deferred from: code review of 4-1-pick-submission-status-dashboard (2026-05-24)

- **Multiple picks per same `leagueMembershipId`** — `mergeSubmissionStatusParticipants` silently overwrites earlier pick with later one if two picks share the same membershipId for a week. DB unique constraint prevents this in production; address if constraint is ever relaxed.
- **Empty string `user.email` yields blank `displayName`** — `displayName: user.name ?? user.email` renders as empty string if email is `""`. Schema marks email as required/non-empty; revisit if that constraint changes.
- **Sequential DB calls in admin page** — `prisma.league.findUnique` and `buildSubmissionStatus` run sequentially after the membership guard resolves; they could be parallelized with `Promise.all` for a minor latency gain.
- **nflGame with null `weekNumber` passes kickoffAt-only filter** — The type guard `g.kickoffAt != null` doesn't also check `g.weekNumber != null`; a row with null weekNumber (impossible under current schema) would pass through to `resolvePicksWeekNumber`. Tighten the filter if schema ever allows nullable weekNumber.

## Deferred from: code review of story 4-2-submit-or-change-pick-on-behalf-including-post-deadline (2026-05-30)

- **`validateJailedLineupAndBonus` unconditional opponent lookup** — `src/lib/domain/picks.ts:79-88`. The function calls `getOpponentOfJailedInWeek` unconditionally; if it returns `{ ok: false }`, all picks are blocked (not just anti-jailed). In practice the jailed team is always selected from active-week games so the `{ ok: false }` path requires a data anomaly (cancelled game, out-of-sync load). Fix: gate the opponent lookup behind `if (antiJailedBonus)`. Tracked as `pre-epic-5-fix-jailed-lineup-bonus-bug` (defensive correctness, low production risk).
- **Concurrent admin submissions produce silent last-write-wins** — `submit-pick-on-behalf.ts` + `route.ts`. Two concurrent admin overrides for the same participant+week both see no existing pick, both upsert, both return 201. Requires optimistic locking (e.g., `updatedAt` ETag passed in request, checked inside transaction) or a `SELECT ... FOR UPDATE` advisory lock. Low practical risk on admin-only flow; revisit if automation or multi-admin leagues become common.
- **`priorSeasonPickCount` fetched before `existing` check** — `submit-pick-on-behalf.ts:130-167`. Theoretical: if a concurrent delete empties season picks between count and findUnique, the lock fires on an update path. The `updateMany` guard (`firstCompetitionWeekLockedAt: null`) prevents double-lock; negligible real-world risk given pick deletes don't exist in the product today.
- **TOCTOU role check outside transaction** — `route.ts:78-90`. Admin role fetched before the transaction opens; a membership role change between the check and the write would not be caught. Pre-existing pattern across all admin routes; fix when the codebase adopts a middleware-level role guard.
- **`allSeasonPicks` over-fetch in `buildAdminOverrideData`** — `build-admin-override-data.ts:101-108`. Loads all picks for the season across all participants. For large leagues late in an 18-week season this grows O(participants × weeks). Add pagination or a `leagueId`-scoped filter joining through `LeagueMembership` if performance degrades.

## Deferred from: code review of pre-epic-5-thursday-lockout-constant (2026-06-11)

- **Magic `0` for seconds survives in `lockByThursdayDefaultUtc`** — `src/lib/domain/pick-deadline.ts`. The call `new Date(ty, tm - 1, td, THURSDAY_LOCK_HOUR, THURSDAY_LOCK_MINUTE, 0)` still has an inline `0` for seconds. If the lock time ever shifts to a non-zero second, there is no constant to update and no test to catch the omission. Extract `THURSDAY_LOCK_SECOND = 0` alongside the existing constants when this file is next touched.
- **No DST-boundary test for Thursday lockout hour** — `src/lib/domain/pick-deadline.test.ts`. The new and existing tests use October dates (summer time). The first Thursday of November — when clocks fall back — changes the UTC equivalent of 8:10 PM ET by one hour. Add a test fixture for a DST-transition Thursday when test coverage for this function is next expanded.
- **Exported constants create implicit public API with no deprecation path** — `src/lib/domain/pick-deadline.ts`. `THURSDAY_LOCK_HOUR` and `THURSDAY_LOCK_MINUTE` are public exports that any module can import and build arithmetic against. If FR26 changes, updating the constants alone is insufficient — silent breakage in any consumer that hard-coded derived values. Consider an `@internal` annotation or barrel-export gating if the constants gain external consumers.
- **Kickoff exactly at `THURSDAY_LOCK_HOUR:THURSDAY_LOCK_MINUTE` untested** — `src/lib/domain/pick-deadline.test.ts`. A Thursday kickoff at exactly 8:10 PM Eastern produces a first-game lock at 8:05 PM; `computePickDeadlineUtc` should pick 8:05 (first-game wins). The boundary where the two lock times converge is not exercised. Add when broadening `computePickDeadlineUtc` coverage.

## Deferred from: code review of pre-epic-5-fix-jailed-lineup-bonus-bug (2026-06-11)

- **Third new test redundant to AC3 / bye-scenario precondition mismatch** — `picks.test.ts`. The "rejects direct jailed pick even when jailed team has no game in week games" test exercises the `teamId === jailedTeamId` guard (unchanged code). AC3 requires a jailed-team-in-game precondition; existing pre-diff tests already cover that. The new test adds bye-scenario confidence but is not a strict AC3 test.
- **Test assertions on exact user-facing copy are brittle** — `picks.test.ts`. New tests assert the full 140-char message string inline rather than against a named constant. Fragile to copywriting; revisit when a shared error-constants module is introduced.
- **`JAILED_NOT_IN_WEEK_GAMES` error code name semantically misleading** — `picks.ts:85`. Code name implies a general schedule-data anomaly but is now only reachable on the `antiJailedBonus: true` path. Rename (e.g. `ANTI_JAILED_UNAVAILABLE`) when the API error contract can be versioned and all callers updated.
- **No determinism test for `getOpponentOfJailedInWeek` with duplicate game rows** — `picks.ts`. If `jailedTeamId` appeared in two games (data corruption), the helper returns the first match silently. Test should live in `getOpponentOfJailedInWeek`'s own unit coverage, not in the validator.

## Deferred from: code review of 4-4-jailed-team-verification-view (2026-05-30)

- **`jailed.randomSeed` (DB) vs `audit.randomSeed` (JSON) not cross-validated** — `src/lib/admin/get-jailed-verification.ts`. The route returns `jailed.randomSeed` (the DB column) rather than `audit.randomSeed` (the value inside `auditJson`). If they diverge, the FR52 audit display shows the wrong seed. Fix when FR52 audit compliance is hardened.
- **`resolvePicksWeekNumber` called independently in page and `getJailedVerification`** — `src/app/(app)/leagues/[leagueId]/admin/page.tsx`. At a week-boundary crossing the page's `weekNumber` (used in the jailed empty-state message) and the jailed section's internal `weekNumber` could diverge by 1. Fix by threading a shared `now` if the mismatch becomes observable.
- **No fallback to the most recently computed jailed week** — `src/lib/admin/get-jailed-verification.ts`. Once `resolvePicksWeekNumber` advances to week N+1, the jailed section shows null until computation runs for N+1, even though week N's record exists. Revisit when "view prior-week jailed" is requested.
- **Backward-compat rows show no stage chips with no UI hint** — `src/components/admin/AdminJailedVerification.tsx`. Old `NflWeekJailedTeam` rows missing `afterMoneyline`/`afterSpread` display no stage chips, with no indication to admins that stage data is simply unavailable (vs. a clean single-winner MONEYLINE result). Add a "(legacy data — stage breakdown unavailable)" hint if UX feedback warrants it.
- **`jailed.jailedTeamId` (DB) vs `audit.jailedTeamId` (JSON) never cross-checked** — `src/lib/admin/get-jailed-verification.ts`. A corrupt row where the DB column and the JSON diverge would silently show inconsistent data. Fix when a data-consistency validation layer is added.
- **`.passthrough()` on `AuditJsonV1Schema` allows unknown fields** — `src/lib/admin/get-jailed-verification.ts`. Intentional for forward-compat, but weakens strictness. Revisit if schema drift causes runtime issues.
- **`afterMoneyline`/`afterSpread` optional in Zod but required in domain type** — `src/lib/admin/get-jailed-verification.ts`. A future persistence path that omits these fields would pass Zod but show null in the UI silently. Monitor if new computation paths are added.

## Deferred from: code review of 5-3-mnf-completion-and-tuesday-standings-update (2026-06-14)

- **Timing-safe comparison on bearer token** — `src/lib/nfl/authorize-odds-admin.ts:14`. `isOddsAutomationRequest` uses `===` for secret comparison rather than `crypto.timingSafeEqual`. Pre-existing in both original route copies; moved unchanged. Low practical risk on an admin endpoint behind infrastructure; swap when a broader auth hardening pass is done.
- **Unconditional `auth()` call for automation requests** — `src/app/api/admin/scoring/finalize-week/route.ts`. `auth()` fires a session lookup even when the bearer token already identifies the caller; `assertAuthorizedForNflOddsOps` short-circuits before using userId, so it is harmless. Pre-existing from `score-week` pattern. Skip the `auth()` call when `isOddsAutomationRequest` is true if request latency becomes a concern.
- **No try/catch in route handler** — `src/app/api/admin/scoring/finalize-week/route.ts`. Uncaught exception from `auth()`, `assertAuthorizedForNflOddsOps`, or `readJsonObject` propagates as an unhandled Next.js 500. Pre-existing from `score-week` pattern; address when a global error-handling layer is introduced.
- **`z.coerce.number()` accepts boolean values as integers** — `src/app/api/admin/scoring/finalize-week/route.ts:17`. `true` coerces to `1`, silently passing Zod's `min(1).max(18)` check and running finalization against week 1. Pre-existing pattern; spec explicitly specifies `z.coerce.number()`. Switch to `z.number()` (no coerce) across all admin scoring routes if strict JSON typing is later desired.
- **Authorization header trailing whitespace not handled** — `src/lib/nfl/authorize-odds-admin.ts:14`. A token value with a trailing space would be rejected. Pre-existing in original route copies; add `.trim()` to `request.headers.get("authorization")` when the function is next touched.
- **No DB transaction between game-status check and `scoreNflWeek`** — `src/lib/scoring/finalize-nfl-week.ts`. Games are fetched with `findMany`, finalization gate is checked, then `scoreNflWeek` is called as a separate operation; a concurrent sync correcting a game status in that gap would not be caught. Same class as the read-then-write race deferred from 5.2.
- **`weekNumber` max of 18 excludes playoff rounds** — `src/app/api/admin/scoring/finalize-week/route.ts`. NFL playoff weeks use values above 18 in many data providers. Spec-specified at `.max(18)` for MVP; raise when playoff scoring is in scope.
- **Non-object JSON body coerced to `{}`** — `src/app/api/admin/scoring/finalize-week/route.ts`. A JSON array or `null` body becomes `{}`, yielding "weekNumber is required" rather than a type-mismatch error. Pre-existing from `score-week` pattern; cosmetic.

> **Note:** The 5.2 deferred item "**`isOddsAutomationRequest` duplicated across two route files**" was resolved in this story (5.3, AC4).

## Deferred from: code review of 5-2-calculate-weekly-points-1-vs-2-anti-jailed (2026-06-14)

- **No DB atomicity CHECK constraint on three scoring columns** — `outcome`, `points_earned`, and `scored_at` on the `picks` table have no `CHECK` constraint enforcing all-or-nothing writes. A future bug could leave a row with `outcome = 'WIN'` and `points_earned = NULL`. Adding `CHECK ((outcome IS NULL AND points_earned IS NULL AND scored_at IS NULL) OR (outcome IS NOT NULL AND points_earned IS NOT NULL AND scored_at IS NOT NULL))` via a new migration would close this.
- **No range CHECK constraint on `points_earned`** — column is a plain `INTEGER`; domain only ever produces 0, 1, or 2. Add `CHECK (points_earned >= 0 AND points_earned <= 2)` via a future migration when scoring rules solidify.
- ~~**`isOddsAutomationRequest` duplicated across two route files**~~ — **Resolved by Story 5.3 (AC4)** — extracted to `src/lib/nfl/authorize-odds-admin.ts`.
- **Team in multiple FINAL games causes silent map collision in `scoreNflWeek`** — `winnerByTeamId` maps `teamId → GameWinnerResult` with no collision guard; if a team somehow appears in two FINAL games in the same week (data corruption), the second result silently overwrites the first and picks are scored against the wrong game. Add a guard or early return when this is detected.
- **FINAL game with null scores silently counted as `skipped`** — `score-nfl-week.ts` skips games where `homeScore == null || awayScore == null` via `continue`, incrementing no counter; picks for those games fall through to the `skipped` increment as if the game were not FINAL. Operator cannot distinguish a data anomaly from a legitimately not-yet-final game from the response alone.
- **Read-then-write race in `scoreNflWeek`** — picks are loaded via `findMany` before the `$transaction` opens; a pick submitted in the gap between the two DB calls is invisible to the run and appears in neither `scored` nor `skipped`. Low practical risk for an admin-triggered operation; resolve by moving the picks query inside the transaction when a batch/serializable approach is adopted.

## Deferred from: code review of 5-4-live-leaderboard (2026-06-14)

- **Missing `generateMetadata` export on standings page** — `src/app/(app)/leagues/[leagueId]/standings/page.tsx`. Browser tab uses layout default title. Add a `generateMetadata` function that includes the league name once that pattern is adopted across pages.
- ~~**Current user row: color-only highlight lacks WCAG 1.4.1 non-color indicator**~~ — **Resolved by Story 6.6** (`aria-current="row"` + visually hidden “(You)”); verified in Story 7.3 axe/semantics tests.
- **Outcome comparisons use raw string literals instead of Prisma-generated enum** — `src/lib/scoring/get-league-standings.ts:43`. `p.outcome === "WIN"` / `"LOSS"` / `"TIE"` — enum rename silently breaks comparisons. Pre-existing pattern across all scoring files (5.2, 5.3); fix in a single enum-import pass across the scoring module.
- **`user.email` may be null in OAuth scenarios; null displayName crashes `localeCompare`** — `src/lib/scoring/get-league-standings.ts:36`. Same as the roster page pattern. If email is non-nullable in the schema this is a non-issue; otherwise add `?? m.id` as ultimate fallback. Verify schema nullability before acting.
- **All `leagueMembership` rows included in standings regardless of role** — `src/lib/scoring/get-league-standings.ts:22`. Non-playing roles (e.g., COMMISSIONER without picks) appear in standings with zeros. Story 2.6 made admin a full participant, but if non-participant roles exist they surface here. Filter by participant roles in a future story if the role model expands.

## Deferred from: code review of 5-6-tuesday-reveal-vs-peer-visibility (2026-06-16)

- **notFound() on unauthenticated session should redirect to sign-in** — `src/app/(app)/leagues/[leagueId]/results/page.tsx`. Same pre-existing pattern deferred from 5-5; fix when a unified auth-redirect middleware is introduced.
- **Email-as-display-name fallback exposes PII to all league members** — `src/lib/scoring/get-league-peer-pick-history.ts`. `user.name ?? user.email` is spec-mandated but email is visible to every participant after a week reveals. Revisit when a user profile / display-name story is scoped.
- **No `generateMetadata` on results page** — `src/app/(app)/leagues/[leagueId]/results/page.tsx`. Pre-existing pattern across all protected app pages; add when a global SEO/title pass is done.
- **Test mocks do not validate Prisma WHERE clauses** — `src/lib/scoring/get-league-peer-pick-history.test.ts`. Mocked Prisma returns fixed data regardless of query params; a wrong `leagueId` or `seasonId` would pass all tests. Address with integration/e2e tests against a real DB or a Prisma mock that validates inputs.

## Deferred from: code review of 5-5-personal-pick-history (2026-06-16)

- **scoredAt/outcome field inconsistency on partial DB writes** — `src/lib/scoring/get-personal-pick-history.ts`. PENDING is determined solely by `outcome == null`; if a future scoring bug sets `outcome` without `scored_at` (or vice versa), the display diverges from the intent. AC1 says "scoredAt IS NULL / outcome IS NULL" are equivalent indicators; add a CHECK constraint (see 5.2 deferred) or check both fields when data integrity is hardened.
- **season.findFirst non-deterministic on duplicate records** — `src/lib/scoring/get-personal-pick-history.ts`. If two Season rows share `(leagueId, nflSeasonYear)`, `findFirst` silently picks one. Schema likely enforces uniqueness; switch to `findUnique` and get a compile-time guarantee in a future scoring refactor pass.
- **notFound() on unauthenticated session should redirect to sign-in** — `src/app/(app)/leagues/[leagueId]/history/page.tsx`. A 404 provides no recovery path for logged-out users. Pre-existing pattern across all protected app pages; fix when a unified auth-redirect middleware is introduced.
- ~~**minHeight: "100vh" on page Stack inside nested layout**~~ — **Resolved by Story 9.5** — removed nested `minHeight: "100vh"` from league pages inside global app shell; shared `appContentWidthSx` applied.
- ~~**Breadcrumb link accessibility polish**~~ — **N/A / stale for history** — history breadcrumb removed in Story 6.6; league home “Your leagues” breadcrumb polished in Story 7.3 (`<nav aria-label="Breadcrumb">` + decorative arrow `aria-hidden`).
- **React key on nflWeekNumber** — `src/components/history/PickHistoryTable.tsx`. DB unique constraint on `(leagueMembershipId, seasonId, nflWeekNumber)` prevents duplicates in practice; exposing a stable DB row ID in `PickHistoryEntry` would be safer if the constraint is ever relaxed.
- **Unhandled Prisma rejections propagate as 500** — `src/app/(app)/leagues/[leagueId]/history/page.tsx` and `src/lib/scoring/get-personal-pick-history.ts`. No try/catch; DB errors surface as unhandled Next.js 500. Pre-existing pattern across all server components; address when a global error-handling layer is introduced.

## Deferred from: Epic 5 retrospective (2026-06-16)

- **`AdminPickOverrideDialog.tsx` pre-existing lint errors** — `src/components/admin/AdminPickOverrideDialog.tsx`. Two lint errors present since at least Story 4.2; noted as "pre-existing, unrelated" in completion notes for Stories 5.1–5.6 but never added here. Fix at start of next story that touches the admin panel. Success criteria: `npm run lint` reports zero errors project-wide.

- **N+1 pattern in `score-nfl-week.ts` `$transaction` loop** — `src/lib/scoring/score-nfl-week.ts`. Per-pick sequential `tx.pick.update` calls inside a single transaction (up to `participants × weeks` calls per season scoring run). Same class as the `sync-nfl-results.ts` N+1 already documented above. At ≤14 participants MVP scale this is acceptable; batch with `updateMany` or a raw SQL update when participant count grows. Flag for Epic 7 hardening.

- **Prisma `$transaction` counter double-counting footgun** — Counters (e.g. `scored`, `skipped`) declared in outer function scope and mutated inside the `$transaction` callback will accumulate across Prisma serialization-failure retries. Pattern fix: declare and return counters *inside* the transaction callback. First caught in Story 5.2 review; Story 5.3 corrected its implementation. Reference this item in future story specs that use `$transaction` with mutable counters.

## Deferred from: code review of 4-3-audit-trail-for-overrides-and-admin-pick-visibility (2026-05-30)

- **No pagination/limit on `getAuditLog`** — `src/lib/admin/get-audit-log.ts:23`. Unbounded `findMany` fetches entire override history on every page load and API call. Add a `take` limit (e.g., 100) and cursor-based pagination when audit trails grow beyond a single season of overrides.
- **RESTRICT FK on membership deletes will block future member-removal features** — `prisma/schema.prisma`, `migration.sql`. `onDelete: Restrict` on `admin_membership_id` and `target_membership_id` FKs means any future member-removal story will hit a DB constraint error. Revisit when a member-removal or soft-delete story is scoped; options include `SET NULL` with nullable FK or application-level nulling before delete.
- **Missing secondary index on `adminMembershipId`** — `prisma/schema.prisma`. Current index is `(leagueId, createdAt DESC)`. A future "show all overrides performed by this admin" query will full-scan. Add `@@index([adminMembershipId])` when that feature is built.
- **Update test asserts same team ID before and after** — `src/lib/admin/submit-pick-on-behalf.test.ts`. The "updates existing pick → 200" test uses `team-away` for both existing and submitted team; the meaningful case (admin changes pick to a different team) is not covered. Add a test case with distinct before/after teams.
- **Email fallback in `adminName`/`targetName` exposes PII in admin UI** — `src/lib/admin/get-audit-log.ts:36-37`. When `user.name` is null, the user's email is displayed in the admin audit log. Email is PII; mask or replace with a non-identifying handle if GDPR compliance is required in future.
- **`adminMembershipId` function parameter not validated to calling session** — `src/lib/admin/submit-pick-on-behalf.ts`. The function accepts `adminMembershipId` as an argument and trusts it without verifying it belongs to the caller. Current route always passes `adminMembership.id` fetched from DB, so no actual risk today; consider an internal assertion or encapsulation if the function gains additional call sites.
- **`AuditLogEntryView.createdAt` typed as `string`** — `src/lib/admin/get-audit-log.ts`. Serialization to ISO string happens inside the data-access layer rather than at the API/serialization boundary. Future callers needing timestamp comparison must re-parse. Consider keeping `Date` in the domain type and serializing only at the route response layer.

## Deferred from: code review of pre-epic-6-email-provider-spike (2026-07-04)

- ~~**Resend idempotency rolling window duration unspecified**~~ — Resolved in Story 6.1: 24-hour window documented in `src/lib/email/resend-client.ts` (see [Resend idempotency docs](https://resend.com/docs/dashboard/emails/idempotency-keys)).
- ~~**NFR32 webhook owner unassigned**~~ — **Owner: Story 7.2** (`docs/observability-scope-decision.md`, 2026-07-05). Scope: log-only `POST /api/webhooks/resend` with Svix signature verification; delivery/bounce events logged to structured console. Admin UI for per-recipient delivery status deferred post-MVP.
- ~~**HTTP 429 retry should be differentiated from transient errors**~~ — Resolved in Story 6.1: `send-with-retry.ts` short-circuits on `statusCode === 429`.
- ~~**`RESEND_API_KEY` absent at SDK construction — no startup guard**~~ — Resolved in Story 6.1: `resend-client.ts` throws at module load.
- **Hobby ±1 hr negative-drift silent-skip risk** — `docs/email-provider-decision.md`. If Vercel fires the cron an hour early (negative drift), the ET time-gate check rejects the invocation and emails are silently skipped for the week. The idempotency sent-flag cannot distinguish "not yet sent" from "skipped". **Mitigation (Story 7.2):** `AdminWeeklyEmailStatus` card shows missing timestamps; ops runbook documents manual log spot-check. **Automated alert:** **Resolved by 7.4** — cron returns HTTP 500 when `failed > 0`; external monitor setup in `docs/deployment.md`. Manual admin send routes remain the immediate fallback.
- ~~**Hyphen delimiter in idempotency key ambiguous with hyphenated IDs**~~ — Resolved in Story 6.1: colon delimiter (`invitation:${rawToken}`).

## Deferred from: Story 6.1 — transactional email integration (2026-07-04)

- ~~**Replace placeholder Resend `from` domain before production go-live**~~ — **Resolved** (`post-epic-9-resend-domain-and-from-address`, 2026-08-03): `send.nflpickem.cc` Verified; Production `RESEND_FROM=Pick Six <noreply@send.nflpickem.cc>` + redeploy. Code `DEFAULT_FROM` placeholder intentionally unchanged (env override is the design).
- ~~**Invites page copy still references console logs**~~ — Resolved in Story 6.6: `invite-participants-form.tsx` and `invites/page.tsx` now reflect that invitation emails are sent to recipients.

## Deferred from: code review of 6-2-tuesday-6-00-pm-league-email-content-and-admin-preview (2026-07-04)

- **TOCTOU race on concurrent sends** — `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`: two concurrent POST requests (double-click or cron+admin overlap) can both pass the `sentAt=null` check before either upserts, potentially triggering duplicate send loops. Resend idempotency keys mitigate within 24h. Proper fix requires DB-level advisory lock or atomic conditional-upsert pattern.
- ~~**Sequential per-member send may exceed serverless timeout**~~ — **Resolved by 7.4** — `maxDuration = 300` on cron routes; bounded concurrency (`EMAIL_SEND_CONCURRENCY = 4`) + Resend circuit breaker in digest/reminder senders.
- **`force=true` resends to all members after Resend idempotency key expiry** — `src/app/api/leagues/[leagueId]/email/tuesday-send/route.ts`: after 24h idempotency keys expire; a forced resend re-iterates every member and members who received the original digest may receive duplicates. Acceptable for an admin tool; address if duplicate-send complaints arise.

## Deferred from: code review of 6-3-wednesday-and-thursday-reminders (2026-07-04)

- **Stale `outstandingCount` SSR prop in `AdminReminderControls`** — `src/components/admin/AdminReminderControls.tsx`. The `outstandingCount` prop is computed at SSR time and never refreshed on the client; after members submit post-load, the outstanding count label and the `allSubmitted` button-disable guard remain frozen at the stale value for the lifetime of the page. Same inherent tradeoff as `AdminEmailComposer`. Address with a live-polling or WebSocket approach when real-time admin UX is prioritised.
- **`sentAt` DB upsert failure causes response/DB desync** — `src/lib/email/send-reminder.ts`. If the `leagueWeekEmailConfig` upsert throws after the send loop completes, the route returns `sentAt: <timestamp>` to the client while the DB still has `null`. Subsequent calls pass the idempotency guard and re-send. Same class as `send-tuesday-digest.ts`; wrap the upsert in a separate try/catch and return `sentAt: null` on upsert failure if operational correctness is later required.
- **No inactive/departed membership filter in `getReminderData`** — `src/lib/email/get-reminder-data.ts`. `leagueMembership.findMany({ where: { leagueId } })` has no status or role filter; if a future membership soft-delete or inactive flag is added, former members will continue to receive reminder emails. Mirrors `get-tuesday-digest-data.ts` exactly. Add a `status: 'ACTIVE'` filter when a membership lifecycle model is introduced.
- **Route calls `getReminderData` before idempotency guard** — `wednesday-reminder/route.ts` and `thursday-reminder/route.ts`. On every 409 (already-sent) path, the full multi-table `getReminderData` query runs unnecessarily because `nflSeasonYear + weekNumber` are needed to key the config lookup. Cannot be avoided without caching week resolution separately. Document as accepted cost; optimise if 409-path latency becomes observable.

## Deferred from: code review of 6-4-email-deep-links-to-picks (2026-07-04)

- **`auth()` called without try/catch in `login/page.tsx`** — `src/app/login/page.tsx:16`. A corrupt JWT cookie causes `jose` to throw a parse error, crashing the login page with a 500 instead of gracefully falling through to render the login form. Pre-existing unguarded `auth()` pattern across all server components; address when a global error-handling layer is introduced.
- **`callbackUrl` as `string[]` silently falls through to `/dashboard`** — `src/app/login/page.tsx:19-21`. If the query string contains two `callbackUrl` params (e.g. from a crafted URL), Next.js produces a `string[]`; the `typeof rawCallback === "string"` guard returns `null` and the user lands at `/dashboard`. Spec prescribes this pattern. Enhancement: extract `Array.isArray ? rawCallback[0] : rawCallback` to preserve the first value. Defer until open-redirect audit.
- **No path-traversal or open-redirect negative tests for picks deep-link pattern** — `src/lib/callback-url.test.ts`. The new positive tests confirm `/leagues/x/picks` passes through; no corresponding negative tests confirm that `/leagues/../../admin`, `//evil.com/leagues/x/picks`, or similar variants are rejected. Existing `getSafeCallbackPath` tests may cover this; add explicit picks-scoped negative assertions in a future security hardening pass.
- **URL fragment in `callbackUrl` silently stripped by `getSafeCallbackPath`** — `src/lib/callback-url.ts`. A `callbackUrl` like `/leagues/x/picks#week5` loses the fragment; the user lands at the top of the picks page rather than the anchored section. Pre-existing behaviour in `getSafeCallbackPath`; extend the return path to include `${u.pathname}${u.search}${u.hash}` if hash-based navigation is ever used in the app.

## Deferred from: code review of 6-1-transactional-email-integration (2026-07-04)

- ~~**`from` address placeholder**~~ — **Resolved** via Production `RESEND_FROM` env override (`post-epic-9-resend-domain-and-from-address`, 2026-08-03); code constant left as fallback.
- **No `server-only` import on email server modules** — `resend-client.ts` and `send-invitation-email.ts` lack `import 'server-only'`; startup guard provides runtime protection but no build-time enforcement. Add `import 'server-only'` to both files in a future cleanup pass.
- **No input validation for empty `to` / empty `rawToken`** — `sendInvitationEmail` does not guard against empty `to` or `rawToken`; empty values produce degenerate signup URLs (`/signup/`) and idempotency key collisions (`invitation:`). API route callers validate upstream. Add defensive guards in a hardening pass.

---

## Deferred from: Epic 7 retrospective (2026-07-19)

- ~~**Authenticated Lighthouse re-measure for picks/standings**~~ — **Resolved by Story 9.4** (2026-07-28). Evidence: `docs/performance-budgets.md` picks/standings Lighthouse tables (authenticated, Lighthouse 12.8.2). Mobile LCP slightly over NFR1 re-accepted with owner Kyle.
- ~~**Real pick-submit NFR5 timing sample**~~ — **Resolved by Story 9.4** (2026-07-28). Evidence: `docs/performance-budgets.md` NFR5 table — success-path `durationMs` 453ms / 425ms.

## Deferred from: Epic 8 retrospective (2026-07-28)

- ~~**Email circuit-breaker e2e under simulated outage**~~ — **Resolved by Story 9.4** (2026-07-28). Evidence: Vitest drill in `src/lib/email/send-tuesday-digest.test.ts` (Resend always-fail, ≥4 members, never suppress; asserts `EMAIL_CIRCUIT_OPEN` + abort remaining + shared breaker across leagues).
- **Tracking note:** Launch blockers (scoring isolation, domain investigation, forgot-password, UI polish) are **sprint-status Epic 9 stories**, not deferred bullets. Ops go-live items renamed `post-epic-8-*` → `post-epic-9-*`.

## Pre-production go-live: Vercel operational checklist (Epic 6 — operational, not code)

> **Canonical copy moved to [`docs/deployment.md`](../../docs/deployment.md)** (Story 7.4). Do not maintain a second checklist here — update that doc instead.
>
> Post–Epic 9 handoff items (`post-epic-9-vercel-production-env-and-cron`, `post-epic-9-resend-domain-and-from-address`, `post-epic-9-production-smoke-test`) remain tracked in `sprint-status.yaml`. (Renamed from post-epic-8 at Epic 8 retrospective 2026-07-28.)

~~**Context:** Stories 6.1–6.5 implement transactional email and cron orchestration in code. Before the first real NFL-season weekly cycle in production, a deployer must complete the Vercel-side configuration below.~~

<details>
<summary>Historical checklist (struck — see docs/deployment.md)</summary>

~~Required Production env vars, email/cron go-live steps, migrations, and success criteria lived here until Story 7.4.~~

</details>

## Deferred from: code review of 6-5-cron-routes-secrets-and-idempotent-weekly-orchestration (2026-07-04)

- ~~**No `maxDuration` in `vercel.json`**~~ — **Resolved by 7.4** — `export const maxDuration = 300` on each cron `route.ts` (prefer route-segment over `vercel.json` functions globs).
- **Timing side-channel from length pre-check in `assertCronRequest`** — The early return before `crypto.timingSafeEqual` when buffer lengths differ technically leaks the secret's byte-length via response-time variance. The spec explicitly authorizes this approach (to avoid `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`). A fully constant-time implementation would pad both buffers to a common length before comparing. Acceptable for MVP; revisit if a stricter security posture is required.
- ~~**No unit tests for `isInEasternWindow`**~~ — **Resolved by Story 7.2**.
- **TOCTOU race on idempotency check (read-then-send-then-write)** — Two concurrent cron invocations could both pass the `sentAt == null` guard before either sets it, resulting in duplicate email sends. Accepted per Story 7.4 AC8 — **out of scope**; Resend's 24-hour idempotency key remains the backstop.
- ~~**HTTP 200 always returned even when `failed > 0`**~~ — **Resolved by 7.4** — HTTP **500** when `failed > 0`; **200** for success / `outside_window`.
- ~~**No circuit breaker for email provider outage**~~ — **Resolved by 7.4** — after 3 consecutive provider failures, abort remaining; `code: EMAIL_CIRCUIT_OPEN`.
- **`toLocaleString` ICU dependency in `eastern-window.ts`** — `new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))` relies on ICU timezone data being present in the Node.js runtime. Vercel's full-ICU runtime makes this safe in production. If the runtime environment ever changes (e.g., edge runtime, custom Docker image with `--small-icu`), this call could produce an Invalid Date, silently causing all window checks to return false. Migrate to a library like `date-fns-tz` or use the `Intl.DateTimeFormat` parts API for a more portable approach.

## Deferred from: Story 6.6 — UX spec comparison and alignment (2026-07-04)

- **PickStatusBanner desktop inline with page title** — UX spec shows banner inline with the "This Week" header row on desktop. Requires a header-row refactor; current banner remains full-width below deadline/jailed row.
- **Standings desktop sidebar** — UX spec includes a contextual sidebar on desktop standings. MVP table-only layout retained; enhancement deferred to Epic 7.
- ~~**Global 48px button height enforcement**~~ — **Resolved by 7.4** — theme `MuiButton` medium/large + `MuiTab` `minHeight: 48`.
- ~~**Skeleton loading states**~~ — **Resolved by 7.4** — `loading.tsx` skeletons on picks + standings; **extended by 9.5** with app-level `(app)/loading.tsx` spinner.
- **Snackbar admin feedback** — UX prefers Snackbar for transient admin actions; current inline Alert pattern in email composers is acceptable MVP; polish pass deferred.
- ~~**Landing page hero layout**~~ — **Resolved by Story 9.5** — marketing landing removed; signed-in `/` → `/home`, signed-out → `/login`.
- **`generateMetadata` on league pages** — Deferred from Stories 5.4–5.6; Epic 7.
- ~~**Full WCAG Level A audit**~~ — **Resolved by Story 7.3** — login/picks/standings + league shell; see `docs/accessibility-checklist.md`.
- **WeatherBadge component extraction** — Weather remains inline in `MatchupCard`; cosmetic extraction deferred.
- ~~**NFR32 Resend webhooks**~~ — **Owner: Story 7.2** — log-only webhook route per `docs/observability-scope-decision.md`.
- **Real-time admin outstanding count refresh** — Stale SSR `outstandingCount` in `AdminReminderControls`; deferred from 6.3, unchanged in 6.6.

## Deferred from: code review of 6-6-ux-spec-comparison-and-alignment (2026-07-04)

- ~~**Redundant Prisma membership queries in league layout + child pages**~~ — **Resolved by 7.4** — `getLeagueAccess` (`React.cache`) shared by layout + child pages.

## Deferred from: code review of pre-launch-create-account-flow.md (2026-08-03)

- **`auth()` on create-account page has no try/catch** — `src/app/create-account/page.tsx:11`. Same pattern as `login/page.tsx`; story marked optional / not AC-gated. Corrupt session can hard-fail the page.
- **bcrypt 72-byte password truncation** — `src/lib/register-user.ts:37` via shared `signupPasswordFieldSchema` (no max length). Distinct long passwords can collide under bcrypt truncation; affects invite/reset too.
- **Exact-path rate-limit Set misses trailing slash** — `src/proxy.ts` `RATE_LIMITED_POST_PATHS.has(pathname)` for `/api/auth/register` (and sibling auth POSTs). League routes use optional-slash regex; Set paths do not.
- **In-memory register rate-limit buckets are per-instance only** — Already documented in `src/lib/rate-limit.ts`; multi-instance bypass until shared store. Acceptable for Hobby / single-instance MVP.

## Deferred from: code review of story-7-4-performance-and-deployment-hardening (2026-07-19)

- **Circuit-breaker member-skips merged into the same `failed` counter as real Resend errors** — `src/app/api/cron/tuesday-email/route.ts` (and wednesday/thursday reminders). No separate counter in the cron JSON body distinguishes genuine provider failures from breaker no-op skips; ops can't tell which happened after an outage from the summary alone. Not required by AC5's letter ("count remaining as failed/skipped consistently").
- **Circuit-open log events omit the skipped-member count** — `src/lib/email/send-tuesday-digest.ts:104-116`, `src/lib/email/send-reminder.ts:100-115`. `context.remainingAborted: true` is logged but not how many recipients were actually skipped, reducing the diagnostic value of the event.
- **In-memory weather cache has no proactive eviction** — `src/lib/integrations/weather/client.ts:29-30`. Entries are only refreshed when the same cache key is re-requested after expiry; unused stale entries sit in memory indefinitely. Low risk given the tiny key space (~32 team/kickoff combos per week) and serverless instance recycling.
- **Weather client caches a transient failure with the full success TTL** — `src/lib/integrations/weather/client.ts:95-101`. A single blip (non-OK response, timeout) caches `null` for the same 10-minute TTL as a real result, hiding weather for up to 10 minutes even after the provider recovers. Weather is explicitly best-effort/optional with graceful null fallback.
- **`mapWithConcurrency`'s `concurrency` argument isn't validated** — `src/lib/email/map-with-concurrency.ts:15`. `NaN`/`0`/negative values would silently resolve with zero items processed (`Array.from({length: NaN})` yields no workers). Not reachable today — the only caller passes the hardcoded `EMAIL_SEND_CONCURRENCY = 4` constant.
- **`mapWithConcurrency` uses `Promise.all` instead of `Promise.allSettled`** — `src/lib/email/map-with-concurrency.ts:33`. A future mapper that rejects instead of catching internally would reject the whole pool while other in-flight workers continue unawaited. Both current callers (`send-tuesday-digest.ts`, `send-reminder.ts`) self-catch inside the mapper, so not reachable with today's callers.


## Deferred from: code review of spec-odds-api-schedule-sync (2026-08-03)

- **Week inference DST / Tuesday-boundary precision** — `map-schedule-from-events.ts` uses ms/(7d) from week-1 Tuesday ET; rare DST edges could mis-bucket. Revisit if flex/DST complaints appear.
- **Concurrent schedule sync races** — no advisory lock / serializable isolation on upsert+orphan-delete for the same season year.
- ~~**Retire API-Sports modules + env**~~ — **Done** (spec-retire-api-sports): helpers rehomed to `src/lib/nfl/team-lookup.ts`; `api-sports-nfl` + API-Sports sync wrappers removed; `API_SPORTS_*` dropped from `.env.example` / ops docs. Remove stale keys from Vercel if still set.
- **Odds `/events` mid-season incompleteness** — orphan delete is gated (≥200 games + SCHEDULED-only); mid-season upsert-only may leave stale SCHEDULED fixture leftovers until a full-slate sync. Manual cleanup path if needed.


## Deferred from: code review of sprint-change-proposal-2026-09-02 pass 1 (2026-09-02)

- **Rule B removed the deadline's implicit upper bound** — `src/lib/domain/pick-deadline.ts`. `computePickDeadlineUtc` is now `min(kickoffAt) − 5m` over whatever `NflGame` rows exist, so a week missing its opener row computes a *later* deadline anchored on the next-earliest game — potentially after the missing game has been played. The deleted Thursday leg incidentally capped this because it did not depend on row completeness. Not a defect in the approved rule (the proposal chose the kickoff anchor knowingly) but a new residual risk the proposal does not list. Mitigation would be a game-count sanity check or a max-deadline clamp at ingest.
- **Pick-window open (FR26a) is not enforced on the pick-mutation path** — `src/app/api/leagues/[leagueId]/picks/route.ts:317-385`, `src/lib/admin/submit-pick-on-behalf.ts:63-97`. `runPickMutation` enforces `preSeasonInitializedAt`, competition-week membership, jailed availability and the FR26 deadline, but never `computePickWindowOpenUtc`. A hand-crafted POST before the open instant is accepted, and on a first-ever pick it also sets `firstCompetitionWeekLockedAt`. Pre-existing (before pass 1 the UI was interactive for those weeks too, so pass 1 strictly narrows real-user exposure); FR26a and Story 3.6 require only a read-only *render*, and the proposal's §2 does not list this route as a change surface. Decide explicitly in pass 2 whether window-open becomes server-authoritative.
- **An invalid `kickoffAt` yields an Invalid-Date deadline that reads as "never closed"** — `src/lib/domain/pick-deadline.ts:18-39`. Probe-confirmed: `computePickDeadlineUtc(new Date("not-a-date"))` returns `Invalid Date`, and every `at > deadline` comparison against `NaN` is `false`, so `isNflWeekPickWindowClosedByDeadline` reports the window open forever. `getFirstKickoffUtc` does not screen it either (`Math.min(NaN)` is `NaN`), so this is a pre-existing gap at the documented entry point; what changed is the symptom — the deleted Thursday leg called `formatInTimeZone` and threw `RangeError` instead. Not reachable through Prisma `DateTime` columns or the Zod-validated odds mapper today.
- **Upcoming week shows preview with no countdown between Monday-night kickoff and Tuesday 00:00 ET** — `src/lib/nfl/resolve-picks-week.ts:194-202`, `src/app/(app)/leagues/[leagueId]/picks/page.tsx:69`. `resolvePicksWeekNumber` advances to week N+1 once week N has no future kickoffs (MNF kickoff, ~20:15 ET), but `windowOpen(N+1)` is the following Tuesday 00:00 ET, so for ~3h45m each Monday night the page renders the preview banner and `showActiveWeekChrome` hides `DeadlineCountdown` (FR23). Behavior-as-designed under the proposal's deliberate Tuesday-midnight/non-overlap choice, but undocumented and unasserted.
- **Rule C slot 1 can precede the FR26a open instant in compressed weeks** — pass-2 input. Slot 1 is the first tick at or after `deadline − 48h`; for a non-first week whose opener kicks before roughly Wed 15:05 ET that anchor lands before Tuesday 00:00 ET, and the send would be skipped as `isPreviewWeek`. No 2026 week triggers it (Week 12's anchor is Mon Nov 23 19:55 but the first tick after it is Tue Nov 24 06:00 EST, inside the window by ~6h). Rule C's prescribed `shouldSendWeeklyReminder({ slot, deadline, now, alreadySentAt })` signature carries no window-open input, so pass 2 must decide whether it supersedes or composes with the preview skip.
- **Hardcoded 2026 opener schedule duplicated across two test files** — `src/lib/domain/pick-deadline.test.ts` (15 Thursdays) and `src/lib/nfl/resolve-picks-week.test.ts` (`SEASON_2026_OPENERS`). The two lists agree today and both derive from the proposal's own 18-week table, but they will drift, and neither is checked against the ingested schedule, so a wrong opener passes green. Consolidating into one shared fixture module would remove the drift risk.
- **Preview has no upper bound, so a past week renders interactive and 403s on submit** — `src/lib/nfl/resolve-picks-week.ts:202`. `computePicksUiIsPreview` returns `now < windowOpen`, so viewing Week 1 in December yields `isPreview === false` and an editable pick UI whose submit is rejected by the deadline check. Pre-existing (the old kickoff-gated rule behaved identically for past weeks); pass 1 fixed only the future-week direction.
- **Story artifacts 3-5 and 3-6 still document the removed Thursday rule as normative AC** — `_bmad-output/implementation-artifacts/3-5-deadline-enforcement-server-authority.md:27` still reads `pickDeadline = min(lockByFirstGame, lockByThursdayDefault)`. Only `epics.md` was amended, so the repo holds two contradictory AC records. Defensible if story artifacts are immutable historical records, but then the proposal's §2 story-impact table ("AC amended") overstates what was done.
- **Pass 1 must not reach production without Rule C (same *deploy*, not just same commit)** — resolved 2026-09-02: Kyle is not shipping pass 1 standalone. Rationale to preserve: pass 1 flips `isAutomatedEmailWeekActive` to true for 2026 Week 1 from Wed Sep 2 20:15 ET, while the pre-Rule-C `vercel.json` still schedules `thursday-reminder` at `0 0 * * 5` UTC (Thu 20:00 EDT, admitted by `isInEasternWindow(now, 4, 17, 21)`). Deployed alone, that tick would send `"Final reminder — the pick deadline is in about one hour"` to every league from `getActiveLeagueIds` six days before the real Wed Sep 9 20:10 ET deadline, and `sendReminder` would stamp `thursdayReminderSentAt` (it upserts whenever `sent > 0`), burning Week 1's idempotency key. Rule C removes that cron and slot-anchors sends, so every tick from Sep 3 through Sep 7 16:00 ET falls before the `deadline − 48h` anchor (Mon Sep 7 20:10 ET) and self-suppresses; first send is slot 1 on Tue Sep 8 07:00 ET. Guard: confirm the Vercel production branch does not auto-deploy `main` from a pass-1-only commit.
- **`ReminderEmail` copy still says "before Thursday's deadline"** — `src/lib/email/templates/ReminderEmail.tsx:40-43`. FR26 as amended makes this false for 2026 Weeks 1, 12 and 18; the slot-2 string `"the pick deadline is in about one hour"` is also wrong under Rule C's `deadline − 12h` slot (its own coverage table shows ~4–7h margins). Left for pass 2 because Rule C replaces the `reminderType` prop with slot 1 / slot 2 and would otherwise require editing this copy twice.
