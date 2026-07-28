# Story 9.2: Domain-provider investigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the project lead preparing production launch,
I want a **documented decision** on domain registrar / DNS provider,
so that the **same registered domain** can serve as both the **public app URL** on the web and the **Resend sending domain** (SPF/DKIM) before production inbox traffic.

**Source requirements (Kyle — do not soften):**

1. "Do we need to do an investigation into domain providers?"
2. The provider/domain we choose is **not email-only** — it is also the **main domain (URL) for the application on the web itself**. One product domain, dual use: web + transactional email.

**Answer encoded in this story:** **Yes.** Email provider is already decided (**Resend** — `docs/email-provider-decision.md`). What is still missing is **where we buy/host the domain and DNS** so we can (a) point the Vercel app at a real hostname and (b) verify Resend SPF/DKIM on that same domain (typically root/apex or `www` for the app, and a send subdomain for mail). This story **is** that investigation. Do not re-open Resend vs Postmark/SendGrid. Do **not** recommend a throwaway email-only domain disconnected from the app URL.

**Launch-blocker context:** Epic 8 retro (2026-07-28) elevated domain-provider research to Epic 9. It **unblocks** `post-epic-9-resend-domain-and-from-address` (and informs custom-domain / `AUTH_URL` work under `post-epic-9-vercel-production-env-and-cron`). Production env/cron and inbox smoke remain **post-epic-9** — not this story.

## Acceptance Criteria

### AC1 — Decision document exists

**Given** production email still uses placeholder `from` (`Pick Six <noreply@yourdomain.com>` via `getResendFrom()` when `RESEND_FROM` is unset)  
**And** production app hostname is still a Vercel default / placeholder (`AUTH_URL` not yet a real product domain)  
**When** the investigation completes  
**Then** a short decision doc is written at **`docs/domain-provider-decision.md`** (preferred; mirrors `docs/email-provider-decision.md` / `docs/nfl-odds-integration.md`) **or** a clearly titled section is added under **Email / Resend go-live** in `docs/deployment.md`  
**And** the doc records at minimum:

1. **Dual-use constraint (binding):** the chosen registrar/DNS (and registered domain) will be the **main public web URL** for Pick Six **and** the **email sending domain** foundation — not two unrelated domains
2. **Options considered** (registrar and/or DNS host) — at least: Cloudflare Registrar+DNS, Porkbun, Namecheap; note GoDaddy as anti-pattern if mentioned; score each option for **both** Vercel custom-domain DNS (apex/`www` → Vercel) **and** Resend SPF/DKIM
3. **Choice** (or "keep existing registrar/DNS if Kyle already owns a domain") with rationale tied to project constraints (architecture **max free / low-cost** tier, Resend DNS DX, Vercel custom domain, renewal predictability)
4. **Hostname plan** in the decision doc: intended **app host** (e.g. `example.com` or `www.example.com`) and intended **mail send host** (prefer subdomain e.g. `send.example.com` / `mail.example.com` on the **same** registered domain)
5. **Next DNS steps** split by owner:
   - **Web (post-epic-9 env/cron):** add Vercel DNS (A/ALIAS/CNAME as Vercel requires) at chosen DNS → set Production `AUTH_URL=https://…` → redeploy
   - **Email (`post-epic-9-resend-domain-and-from-address`):** add domain in Resend → copy SPF/DKIM(/MX) records → publish at chosen DNS → wait for verify (often minutes; up to ~72h) → set production `RESEND_FROM` → redeploy
6. **Research date** and source links (vendor pricing + Resend domain docs + Vercel custom domains)
7. Explicit statement: **this story does not** register the domain, attach Vercel custom domain, perform Resend cutover, or replace Production `AUTH_URL` / `RESEND_FROM`

---

### AC2 — Explicitly unblocks post-epic-9 domain + Resend work

**Given** `sprint-status.yaml` lists `post-epic-9-resend-domain-and-from-address` as depending on Story 9.2  
**And** `docs/deployment.md` already says domain **provider choice** is Story 9.2  
**When** the decision doc ships  
**Then**:

1. Update `docs/deployment.md` **Email / Resend go-live** (and, if present, env/`AUTH_URL` notes) to **link** the decision doc and state the **dual-use** (app URL + email) choice
2. State clearly that **execution** remains post-epic-9: Vercel custom domain + `AUTH_URL` under `post-epic-9-vercel-production-env-and-cron`; SPF/DKIM + `RESEND_FROM` under `post-epic-9-resend-domain-and-from-address`
3. Optionally add one line to the deferred-work entry **"Replace placeholder Resend `from` domain…"** noting: provider/domain decided in Story 9.2 / `docs/domain-provider-decision.md`; **execution still post-epic-9** (do not strike as resolved until cutover ships)

**And** do **not** mark either `post-epic-9-*` item done

---

### AC3 — No production cutover / no app behavior change required

**Given** this is an investigation + docs story  
**When** the story is complete  
**Then**:

- No requirement to register a domain, change nameservers, attach a Vercel custom domain, or add Resend DNS records in this story (Kyle may optionally do so early; not AC-gated)
- No requirement to change `DEFAULT_FROM` in `src/lib/email/resend-from.ts` or Production Vercel env (`AUTH_URL`, `RESEND_FROM`)
- No UI / frontend changes
- If any code/docs-only touch is made, `npm test` remains green (sanity); no new unit tests required for docs-only

## Tasks / Subtasks

- [x] Task 1 — Investigate registrar/DNS options (AC: #1)
  - [x] Re-verify current pricing / TLD support on Cloudflare Registrar, Porkbun, Namecheap (tiers change — do not ship stale year-old numbers without a check)
  - [x] Confirm Resend DNS requirements + Cloudflare Domain Connect path ([Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Cloudflare](https://resend.com/docs/dashboard/domains/cloudflare), [Namecheap](https://resend.com/docs/knowledge-base/namecheap))
  - [x] Confirm Vercel custom-domain DNS needs for apex and/or `www` on the **same** domain ([Vercel custom domains](https://vercel.com/docs/domains/working-with-domains))
  - [x] Document **hostname plan**: app URL host + mail send subdomain on one registered domain (prefer send subdomain per Resend best practice)
  - [x] If Kyle already owns a product domain: document **keep DNS at current nameserver owner** vs transfer; decision = "DNS host where NS already point," not a forced new registrar — still must support **both** Vercel + Resend records
- [x] Task 2 — Write decision deliverable (AC: #1)
  - [x] Create `docs/domain-provider-decision.md` (preferred) with dual-use constraint, comparison table, choice, hostname plan, next DNS steps (web + email), sources, research date
  - [x] Or, if keeping everything in one ops doc: add equivalent section to `docs/deployment.md` and skip a separate file — but still satisfy AC1 content checklist
- [x] Task 3 — Cross-link + deferred-work note (AC: #2)
  - [x] Link from `docs/deployment.md` Email / Resend go-live (and `AUTH_URL` / env notes) → decision; call out dual-use
  - [x] Note on deferred-work placeholder-`from` entry: 9.2 decided provider/domain; cutover still post-epic-9
- [x] Task 4 — Verify boundaries (AC: #3)
  - [x] Confirm no production cutover claimed in the doc (no Vercel domain attach, no Resend verify-as-done)
  - [x] Confirm story does not re-decide Resend (point at `docs/email-provider-decision.md`)
  - [x] Confirm doc does **not** recommend a separate email-only domain disconnected from the app URL
  - [x] `npm test` if any non-docs file was touched; otherwise optional sanity

## Dev Notes

### What this story is (and is NOT)

| **Is** | **Is NOT** |
|--------|------------|
| Investigation: **domain registrar / DNS host** for **one product domain** used as **app URL + email** | Re-opening transactional **email** provider (Resend already chosen) |
| Hostname plan: web host + mail send subdomain on the **same** registration | Recommending a throwaway / email-only domain separate from the public app URL |
| Decision doc + links that unblock post-epic-9 | Attaching Vercel custom domain or verifying Resend DNS in dashboards (post-epic-9) |
| Next-step checklist for web DNS + email cutover | Changing Production `AUTH_URL` / `RESEND_FROM` or `DEFAULT_FROM` code |
| Clarifying subdomain vs root for **mail** reputation while apex/`www` serve the app | Forgot-password implementation (Story 9.3 — can use Resend; prefers verified domain later) |
| Docs-only (like pre-epic-6 spike) | UI polish / landing / nav (9.5–9.7) |
| | Story 9.7 email HTML layout polish |

### Locked design decisions (do not re-litigate)

1. **Resend stays the email provider.** See `docs/email-provider-decision.md`. This story only picks **domain/DNS**.
2. **One product domain, dual use (binding).** Registrar/DNS choice must support the **public web URL** (Vercel custom domain + `AUTH_URL`, email deep links) **and** Resend sending identity on that same registered domain. Do not split "marketing/email domain" vs "app domain" for MVP.
3. **Cutover stays post-epic-9.** Investigation ≠ register ≠ attach ≠ verify. Web attach/`AUTH_URL` ≈ `post-epic-9-vercel-production-env-and-cron`; SPF/DKIM/`RESEND_FROM` ≈ `post-epic-9-resend-domain-and-from-address`.
4. **Placeholder `from` / default `AUTH_URL` remain valid until cutover.** `getResendFrom()` + `RESEND_FROM` override pattern stays; local smoke may keep `onboarding@resend.dev`.
5. **Architecture "max free tier"** applies: prefer at-cost / low-renewal registrar + free DNS; avoid high-renewal retail traps (classic GoDaddy promo → expensive renew).
6. **Do not invent a second email stack** for forgot-password (9.3) or digests — same Resend + same verified domain eventually.

### Current code / ops facts (ground truth)

```3:11:src/lib/email/resend-from.ts
const DEFAULT_FROM = "Pick Six <noreply@yourdomain.com>";

/**
 * Resend `from` address for all transactional sends.
 * Override with `RESEND_FROM` in `.env.local` for local smoke tests (e.g. `Pick Six <onboarding@resend.dev>`).
 */
export function getResendFrom(): string {
  const override = process.env.RESEND_FROM?.trim();
  return override || DEFAULT_FROM;
}
```

- All sends (invite, Tuesday digest, reminders) call `getResendFrom()`.
- `.env.example` documents optional `RESEND_FROM` for sandbox smoke.
- `docs/deployment.md` Production table lists `AUTH_URL` as absolute site URL for Auth.js callbacks (today often `https://your-app.vercel.app`) — post-epic-9 will point this at the **chosen product hostname**.
- Deferred-work (6.1): **"Replace placeholder Resend `from` domain before production go-live"** — execution = post-epic-9; this story decides **where DNS lives** for **both** web + mail.

### Pre-researched findings (verify at implementation time)

> Research snapshot during story creation (2026-07-28). **Re-check vendor pricing pages** before locking the recommendation — numbers drift.

| Option | Cost shape | DNS | Web (Vercel) + Resend fit | Pick-six notes |
|--------|------------|-----|---------------------------|----------------|
| **Cloudflare Registrar + Cloudflare DNS** | At-cost registration/renewal (no markup); free DNS | Must use Cloudflare NS if registered there | Vercel: CNAME/`www` or Cloudflare-compatible apex; Resend: **"Sign in to Cloudflare"** Domain Connect; mail records **DNS Only** | Aligns with max free / low-cost; strong default if starting fresh for **app + email** |
| **Porkbun** | Near-wholesale, flat renewals; free WHOIS/privacy/extras | Flexible DNS (Porkbun DNS or external) | Manual Vercel + Resend TXT/CNAME/MX — both supported | Good if preferring registrar UX / DNS flexibility without Cloudflare lock-in |
| **Namecheap** | Often cheap year-1, **higher renewals** | Advanced DNS UI; Resend has a Namecheap KB | Manual entry for Vercel + Resend; omit domain suffix in host fields | Acceptable if Kyle already lives there; weaker long-term cost story |
| **Keep existing domain wherever NS already point** | $0 incremental if already owned | Whatever currently answers NS | Add **Vercel + Resend** records at the **authoritative** DNS host | **Preferred if a product domain already exists** — do not force a transfer for aesthetics |

**Dual-use DNS checklist (for the decision doc's "next steps"):**

1. Buy or identify **one** product domain; confirm **who owns nameservers** (`dig NS` / [dns.email](https://dns.email)).
2. **Hostname plan:** e.g. app at `example.com` or `www.example.com`; mail from `send.example.com` (or Resend’s recommended send host) — **same registration**.
3. **Web (post-epic-9):** Vercel → add domain → publish A/ALIAS/CNAME at DNS → set `AUTH_URL=https://…` → redeploy. Deep links / invite URLs must use this host.
4. **Email (post-epic-9):** Resend → Domains → add send domain/subdomain → publish exact SPF/DKIM(/MX) → Verify (often minutes; up to ~72h) → set `RESEND_FROM` → redeploy.
5. Cloudflare: Domain Connect for Resend **or** manual; mail-related records **DNS Only** (not proxied orange-cloud). App CNAME to Vercel follows Vercel’s Cloudflare guidance.
6. Inbox smoke after both: `post-epic-9-production-smoke-test`.

**Recommended lean (agent may confirm or override with rationale):**

- **New domain, no prior DNS allegiance:** Cloudflare Registrar + DNS (at-cost + Resend Domain Connect + Vercel-friendly DNS).
- **Existing domain:** keep current DNS host; document that host as the decision; only transfer if DNS UX blocks **either** Vercel custom domain **or** Resend verification.

### Reuse — do NOT reinvent

| Need | Reuse |
|------|--------|
| Email provider rationale | `docs/email-provider-decision.md` — cite, do not duplicate the Resend vs SendGrid table |
| Ops checklist home | `docs/deployment.md` — link decision; do not fork a second go-live checklist in deferred-work |
| `AUTH_URL` / env table | `docs/deployment.md` + `.env.example` — document intended production hostname in decision; do not set Production secrets in 9.2 |
| `from` address helper | `src/lib/email/resend-from.ts` — leave code alone unless a one-line comment pointing at the decision doc is useful (optional) |
| Decision-doc pattern | Same structure as pre-epic-6 spike → `docs/email-provider-decision.md` |
| Env docs | `.env.example` `RESEND_FROM` / `AUTH_URL` comments — update only if decision names a concrete example domain (optional; avoid fake brands) |

### UX notes (consulted — no UI work)

`ux-design-specification.md` treats **email as the primary engagement channel** (Tuesday digest, reminders, deep links) and admin trust that "it sent." Deep links must land on the **real app hostname**, not a throwaway email-only domain. Story 9.2 is **ops prerequisite** for a coherent public URL + deliverable mail. No components, themes, or flows change here. Forgot-password UX is Story 9.3; email HTML polish is Story 9.7.

### Deferred-work disposition (consulted while planning)

| Item | Disposition for 9.2 |
|------|---------------------|
| **Replace placeholder Resend `from` domain…** (6.1) | **Partially addressed:** document provider choice + next DNS steps; **leave open** until post-epic-9 cutover. Add a one-line note pointing at the decision doc. |
| **`from` address placeholder** (6.1 code review) | Same — still intentional until verified domain |
| AC8 Resend message IDs / production smoke | **Out of scope** — `post-epic-9-production-smoke-test` |
| Suppress-branch email upsert / circuit-breaker e2e | **Out of scope** — 9.4 / later |
| Simulation email runbook edge cases | **Out of scope** |
| Epic 7 Lighthouse / NFR5 | **Story 9.4** |
| UI polish deferred | **Stories 9.5–9.7** |

### Previous story intelligence

**Story 9.1 (done):** Scoring isolation launch blocker; docs updated in deferred-work + runbook. Pattern: tight scope table, explicit "is / is not," mark deferred disposition in the story file.

**Pre-Epic 6 email provider spike (pattern to copy):** Docs-only deliverable; pre-researched findings in the story; agent verifies pricing at write time; permanent record under `docs/`; no app code required; AC includes "no regressions / tests still pass" when touching nothing.

**Epic 8 retro:** Ordered Epic 9 as 9.1 scoring → **9.2 domain** → 9.3 forgot-password → 9.4 carryovers → UI. Post-epic-9 Resend domain **depends on 9.2**.

**Git recent pattern:** focused feat commits; docs commits for retros/runbooks; investigation stories land a single decision markdown.

### Testing requirements

1. Docs-only: no new Vitest required
2. If any `src/` file is touched (optional comment only): run `npm test`
3. Do not claim Resend domain "verified" or Vercel custom domain "live" without evidence — that is post-epic-9

### Project Structure Notes

- **Create:** `docs/domain-provider-decision.md` (preferred)
- **Update:** `docs/deployment.md` (link under Email / Resend go-live; note dual-use for `AUTH_URL`)
- **Optionally update:** `_bmad-output/implementation-artifacts/deferred-work.md` (note on placeholder-from entry)
- **Do not change:** `src/lib/email/*` behavior, cron routes, Vercel Production secrets (in this story)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9; Story 9.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Email delivery NFRs; transactional email risk mitigation]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — max free tier; transactional email; integrations server-only]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Email as primary engagement; deep links (no UI for 9.2)]
- [Source: `docs/project-context.md` — Epic 9 launch hardening; post-epic-9 ops]
- [Source: `docs/email-provider-decision.md` — Resend chosen; domain verify prerequisite]
- [Source: `docs/deployment.md` — Email / Resend go-live; `AUTH_URL`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — placeholder `from` / Resend domain]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-07-28.md` — 9.2 as launch blocker]
- [Source: `_bmad-output/implementation-artifacts/pre-epic-6-email-provider-spike.md` — investigation story pattern]
- [Source: `src/lib/email/resend-from.ts`]
- [Source: Resend — Domains introduction](https://resend.com/docs/dashboard/domains/introduction)
- [Source: Resend — Cloudflare](https://resend.com/docs/dashboard/domains/cloudflare)
- [Source: Resend — Namecheap](https://resend.com/docs/knowledge-base/namecheap)
- [Source: Vercel — Working with domains](https://vercel.com/docs/domains/working-with-domains)

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Re-verified pricing 2026-07-28: Cloudflare at-cost ~$10.44–$10.46 .com; Porkbun flat ~$11; Namecheap promo year-1 / renew ~$15–$18; GoDaddy noted as anti-pattern.
- Confirmed Resend Domain Connect for Cloudflare; mail records DNS Only; prefer send subdomain; verify up to ~72h.
- Confirmed Vercel: apex `A`, subdomain `CNAME` (copy exact targets from project Domains UI).

### Completion Notes List

- Shipped `docs/domain-provider-decision.md` with binding dual-use constraint, comparison table, **choice = Cloudflare Registrar + Cloudflare DNS** (Kyle: starting fresh), hostname plan (www/apex app + `send.` mail subdomain), next DNS steps ordered web → email → smoke, sources, research date, and explicit non-cutover boundaries.
- Cross-linked from `docs/deployment.md` (Email / Resend go-live + `AUTH_URL` note); noted deferred-work placeholder-`from` entry (path corrected to `resend-from.ts`); left all `post-epic-9-*` items backlog.
- Docs-only; no `src/` or Production env changes. `npm test`: 80 files / 476 tests passed.
- Code review (2026-07-28): locked Cloudflare; cutover order / MX inventory / DNS Only / TLD caveat / UI-only Vercel targets; deferred DMARC + Auth cookie guidance to post-epic-9.

### File List

- `docs/domain-provider-decision.md` (created)
- `docs/deployment.md` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/9-2-domain-provider-investigation.md` (modified)

### Change Log

- 2026-07-28: Story 9.2 investigation complete — domain/DNS decision doc + deployment/deferred-work cross-links; status → review.
- 2026-07-28: Code review — locked Cloudflare choice; cutover/DNS hardening patches; status → done.

### Review Findings

- [x] [Review][Patch] Lock Choice to Cloudflare Registrar+DNS (Kyle: starting fresh) [docs/domain-provider-decision.md] — resolved from Decision: branch 2
- [x] [Review][Patch] Document recommended cutover order (web → email → smoke) [docs/domain-provider-decision.md]
- [x] [Review][Patch] Caveat non-.com TLD pricing/support before purchase [docs/domain-provider-decision.md]
- [x] [Review][Patch] Inventory existing MX/SPF; prefer send subdomain to avoid apex mail conflicts [docs/domain-provider-decision.md]
- [x] [Review][Patch] Remove hardcoded Vercel apex IP; UI-only targets [docs/domain-provider-decision.md]
- [x] [Review][Patch] Cloudflare: set Vercel app records DNS Only (not only mail) [docs/domain-provider-decision.md]
- [x] [Review][Patch] Fix stale deferred-work path `send-invitation-email.ts` → `resend-from.ts` [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Defer] DMARC omitted from email DNS plan [docs/domain-provider-decision.md] — deferred, post-epic-9 Resend cutover
- [x] [Review][Defer] Auth.js cookie / apex vs www canonical session guidance [docs/domain-provider-decision.md] — deferred, post-epic-9 AUTH_URL attach
