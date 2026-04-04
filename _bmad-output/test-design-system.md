# System-Level Test Design — pick-six

**Date:** 2026-04-04  
**Author:** Kyle  
**Workflow:** `_bmad/bmm/testarch/test-design` (System-Level / Phase 3)  
**Inputs:** `_bmad-output/planning-artifacts/architecture.md`, `prd.md`, `epics.md`, `implementation-readiness-report-2026-04-04.md`  
**Mode note:** `bmm-sprint-status.yaml` is not present; implementation-readiness is complete. This artifact is the **system-level testability review** before implementation/sprint planning.

---

## Testability Assessment

### Controllability — **PASS (with planned enablers)**

| Criterion | Assessment |
| --------- | ------------ |
| **System state for tests** | **PASS.** PostgreSQL via Neon supports resettable DB state; Prisma migrations + transactional tests (or `prisma migrate reset` in CI) enable deterministic leagues/weeks/picks. Architecture calls for server-authoritative deadlines and picks—tests should drive time via injected clocks or fixed `timestamptz` fixtures, not client clocks. |
| **External dependencies** | **CONCERNS → PASS with mocks.** Odds, email, and (optional) weather are server-only integrations. **Mitigation:** adapter interfaces in `src/lib/nfl/` and email modules; contract tests against recorded fixtures; avoid live APIs in unit/integration default paths. |
| **Error / edge paths** | **PASS.** Zod at API boundary + structured errors enable negative tests; admin overrides and audit logging are testable via API + DB assertions. |

### Observability — **CONCERNS**

| Criterion | Assessment |
| --------- | ------------ |
| **Inspect state** | **CONCERNS.** Architecture targets Vercel logs + structured logging (NFR45). For tests, rely on **API responses**, **DB assertions**, and **optional log capture** in integration—not only `console` in CI. |
| **Deterministic outcomes** | **PASS** for pure/domain logic if time and randomness are controlled (jailed tie-break: architecture requires **seeded** randomness—tests must assert seed + outcome). |
| **NFR validation** | **CONCERNS until automated.** Performance and a11y NFRs need explicit tooling (Lighthouse CI or axe, k6/Lightweight checks for critical routes)—not implied by unit tests alone. |

### Reliability — **PASS**

| Criterion | Assessment |
| --------- | ------------ |
| **Isolation / parallel safety** | **PASS** if tests use isolated DB schemas or transactions per test file and avoid shared global league IDs without cleanup. |
| **Reproducibility** | **PASS** with fixed seeds, UTC storage, and `America/New_York` only in explicit deadline helpers under test. |
| **Boundaries** | **PASS.** REST Route Handlers + Prisma + Zod give clear seams; UI can be tested at component level without duplicating all E2E coverage. |

**Summary:** Overall **testability is good** for a greenfield Next.js app with clear server boundaries. Main gaps are **observability depth in CI**, **cron/email timing**, and **third-party adapters**—address with adapters, fixtures, and a small NFR test pack.

---

## Architecturally Significant Requirements (ASRs)

Quality attributes that drive tests or environments (from PRD NFRs + architecture). Scored **P × I** (1–3 each); **score ≥ 6** needs documented mitigation in implementation.

| ID | ASR | Category | P | I | Score | Test implication |
| -- | --- | -------- | - | - | ----- | ---------------- |
| ASR-1 | Deadline enforcement is server-authoritative; no client bypass | TECH | 2 | 3 | **6** | API integration tests with clock control; E2E spot-check; never trust UI-only assertions. |
| ASR-2 | Pick privacy until Tuesday reveal; admin sees all | SEC/DATA | 2 | 3 | **6** | RSC/props must not leak peers’ picks; API tests for participant vs admin; query-level tests. |
| ASR-3 | Auth/session security (HTTP-only cookies, CSRF on mutations, rate limits) | SEC | 2 | 3 | **6** | Auth.js flow tests; mutation CSRF/rate-limit tests; no secrets in client bundles (lint + build checks). |
| ASR-4 | Audit trail for admin overrides and sensitive actions | DATA/SEC | 2 | 2 | 4 | DB assertions on `audit_log_entries`; immutability expectations. |
| ASR-5 | Scoring correctness (1 vs 2 pts, jailed, anti-jailed) | BUS/DATA | 2 | 3 | **6** | Heavy **unit** coverage on pure scoring/jailed logic; integration tests with fixture weeks. |
| ASR-6 | Email + cron reliability (Tuesday send, reminders) | OPS/INT | 3 | 2 | **6** | Idempotent cron handlers; test with fake timers / manual trigger of route in test env; email provider stub or capture. |
| ASR-7 | Vercel Cron Hobby constraints (daily max, ±1h drift) | OPS | 2 | 2 | 4 | Tests for “should run” guard inside handler (NY time window); monitor in staging. |
| ASR-8 | Performance NFRs (e.g. load &lt;3s, TTI &lt;4s) | PERF | 2 | 2 | 4 | Smoke perf budget on critical routes; not every PR full load test. |
| ASR-9 | WCAG 2.1 Level A | BUS | 2 | 2 | 4 | axe/Lighthouse on key templates; manual keyboard pass on forms. |

---

## Test Levels Strategy

Aligned with **test-levels-framework** (pyramid, avoid duplicate coverage):

| Level | Approx. share | Focus for pick-six |
| ----- | ------------- | -------------------- |
| **Unit** | **45–55%** | Scoring, jailed resolution, tie-break (seeded random), deadline comparison helpers, Zod schemas, pure utilities. |
| **Integration** (API + DB) | **35–45%** | Route Handlers with Prisma + test DB: picks, authz by `leagueId`, admin override + audit, cron handler guard logic. |
| **Component** | **5–10%** | MUI forms, pick submission UX, countdown display (with mocked server data). |
| **E2E (Playwright)** | **5–10%** | 3–8 **critical journeys**: signup/invite path, submit pick before deadline, admin override smoke, Tuesday reveal behavior (may use staged data). |

**Rationale:** Business rules and correctness live in **unit + API integration**; E2E proves wiring and auth flows without re-testing every branch in the browser.

**Environments:** Local: Neon branch or Docker Postgres + Prisma migrate. CI: ephemeral DB (Neon branch or service container). Staging: Vercel preview + Neon preview DB optional for cron/email dry runs.

---

## NFR Testing Approach

| Category | Approach | Tools / artifacts |
| -------- | -------- | ------------------- |
| **Security** | Authz matrix per route; CSRF/rate-limit checks; dependency audit in CI | Playwright for auth flows; OWASP ZAP optional later; `npm audit` / Dependabot |
| **Performance** | Budgets on LCP/TTI for home, pick submission; API latency smoke | Lighthouse CI or `@lhci/cli`; simple k6 on `/api/health` + one authenticated route if needed |
| **Reliability** | Transaction tests; retry behavior for email stub; graceful handling when odds adapter returns errors | Integration tests + unit tests for adapter |
| **Maintainability** | Coverage thresholds on `src/lib/**` scoring/auth; ESLint strict; PR checklist | Vitest/Jest coverage; architecture naming checks |

`tea_use_playwright_utils` is **false** in config—no `@seontechnologies/playwright-utils` requirement; standard Playwright + test DB is enough.

---

## Test Environment Requirements

- **PostgreSQL** compatible with Prisma (Neon or local Postgres).
- **Environment variables** in CI: `DATABASE_URL`, `AUTH_SECRET`, test-only email keys or mocks, `CRON_SECRET` for secured cron routes.
- **Time:** tests use UTC instants; helpers apply `America/New_York` for display/deadline **in one place** under test.
- **Seed data:** factories for User, League, Season, Week, Pick (see `fixture-architecture` / `data-factories` in TEA index when implementing).
- **No production API keys** in unit/integration default paths—use fixtures or WireMock-style stubs.

---

## Testability Concerns (for solutioning / Sprint 0)

1. **Cron precision on Vercel Hobby:** ±1h / daily cron limits may affect “Tuesday 6 PM ET” unless the handler self-gates on NY time—**test the gate**, monitor in staging.
2. **Email deliverability:** Full E2E against real SMTP is flaky; use **test doubles** or provider test mode in CI.
3. **E2E data setup:** Without stable test users, use **API seed** or Prisma seed script invoked from Playwright `globalSetup`.
4. **Pick privacy:** High risk of accidental leak via RSC props or over-fetching—add **grep/review** checklist and tests that assert JSON/HTML for non-admin sessions.

None of these are **FAIL** for architecture; they are **implementation and test-design follow-ups**.

---

## Recommendations for Sprint 0

1. **Test framework:** Add **Vitest** (or Jest) for unit; **Playwright** for E2E; Prisma test DB pipeline in GitHub Actions (or Vercel’s CI when connected).
2. **`*testarch-framework` workflow:** Align config with App Router, `src/lib/db.ts` singleton, and one example API + unit test to set patterns.
3. **`*testarch-ci` workflow:** Stages: `lint` → `typecheck` → `unit` → `integration` (with DB service) → `e2e` (nightly or main-only if slow).
4. **`*testarch-atdd`:** After first stories exist, generate failing tests for P0 scenarios (deadline, pick validation, admin audit)—not blocking this document.
5. **Coverage gates:** Start with **critical paths** (`lib` scoring, authz helpers) ≥ **80%** line coverage before broad UI coverage targets.

---

## Related documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`

---

**Generated by:** BMad TEA — Test Architect Module  
**Knowledge base references:** `nfr-criteria.md`, `test-levels-framework.md`, `risk-governance.md`, `test-quality.md`
