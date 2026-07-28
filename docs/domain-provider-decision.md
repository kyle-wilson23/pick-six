# Domain registrar / DNS provider decision (Story 9.2)

**Investigation:** 2026-07-28 (vendor pricing pages + Resend / Vercel domain docs). **Pricing and TLD lists change** — confirm on each vendor’s site before purchase or transfer. Comparison table prices are **.com** approx.; for other TLDs, confirm registrar support and checkout renewal price before buying.

**Email provider is already decided:** [Resend](./email-provider-decision.md). This document only picks **where we buy/host the product domain and DNS**.

---

## Dual-use constraint (binding)

The chosen registrar/DNS (and registered domain) will be the **main public web URL** for Pick Six **and** the **email sending domain** foundation — **not** two unrelated domains.

| Use | Same registered domain |
|-----|------------------------|
| **App URL** | Apex and/or `www` → Vercel custom domain → Production `AUTH_URL=https://…` |
| **Transactional email** | Resend-verified send host (prefer subdomain) → SPF/DKIM → Production `RESEND_FROM` |

Do **not** register a throwaway / email-only domain disconnected from the public app hostname. Deep links in invites, digests, and reminders must land on the real product URL.

---

## What this story does **not** do

This investigation **does not**:

- Register a domain, change nameservers, or transfer a domain
- Attach a Vercel custom domain or set Production `AUTH_URL`
- Add Resend SPF/DKIM records or claim domain “verified”
- Replace Production `RESEND_FROM` or change `DEFAULT_FROM` in code
- Re-open Resend vs Postmark/SendGrid (see [email-provider-decision.md](./email-provider-decision.md))

**Execution remains post–Epic 9:**

| Work | Owner item |
|------|------------|
| Vercel custom domain + Production `AUTH_URL` (+ env/cron) | `post-epic-9-vercel-production-env-and-cron` |
| Resend SPF/DKIM + Production `RESEND_FROM` | `post-epic-9-resend-domain-and-from-address` |
| Real inbox smoke | `post-epic-9-production-smoke-test` |

**Recommended cutover order:** (1) web DNS + `AUTH_URL` → (2) Resend verify + `RESEND_FROM` → (3) inbox smoke. Do not run production smoke until both web and email are live.

---

## Options considered

Scored for **both** Vercel custom-domain DNS (apex / `www`) **and** Resend SPF/DKIM on the same zone. Approximate **.com** USD/year as of research date — always re-check checkout (and TLD availability) before purchase.

| Option | Cost shape (.com approx.) | DNS | Vercel fit | Resend fit | Pick-six notes |
|--------|---------------------------|-----|------------|------------|----------------|
| **Cloudflare Registrar + Cloudflare DNS** | At-cost register ≈ renew (~$10.44–$10.46); free DNS, WHOIS redaction, DNSSEC | Must use Cloudflare nameservers if registered there | Apex: `A` to Vercel IP (or CNAME flattening); `www`: `CNAME` to Vercel target | **“Sign in to Cloudflare”** Domain Connect; or manual MX/TXT; mail records **DNS Only** (not proxied) | ✅ **Chosen** — max free / low-cost + best Resend DX |
| **Porkbun** | Near-wholesale flat renewals (~$11 register ≈ renew); free WHOIS privacy / DNS / extras | Porkbun DNS or point NS elsewhere | Manual `A` / `CNAME` for Vercel — fully supported | Manual TXT/MX/CNAME from Resend dashboard — fully supported | Runner-up if Cloudflare NS lock-in is undesirable, or if desired TLD is unavailable at Cloudflare Registrar |
| **Namecheap** | Cheap year-1 promo (~$7–$11); **higher renewals** (~$15–$18+) | Advanced DNS UI | Manual `A` / `CNAME` | Resend has a [Namecheap KB](https://resend.com/docs/knowledge-base/namecheap); omit domain suffix in Host fields | ⚠️ Weaker long-term cost vs Cloudflare/Porkbun |
| **Keep existing domain (wherever NS already point)** | $0 incremental if already owned | Authoritative host today (`dig NS` / [dns.email](https://dns.email)) | Add Vercel records at **current** DNS | Add Resend records at **current** DNS | Not applicable — starting fresh (no product domain); revisit only if a suitable owned domain appears later |
| **GoDaddy** (anti-pattern) | Low promo → **expensive renewals** (~$22+) + upsell culture | Usable but noisy UX | Manual records possible | Manual records possible | ❌ Avoid for new purchases — classic bait-and-switch renewals vs architecture “max free / low-cost” |

---

## Choice

**Decision: Cloudflare Registrar + Cloudflare DNS.**

Kyle confirmed (2026-07-28 code review): starting fresh — no existing Pick Six product domain / DNS allegiance. Register the product domain at Cloudflare; zone uses Cloudflare nameservers.

### Rationale

- **At-cost registration and renewal** — no year-2 markup trap; aligns with architecture “max free / low-cost.”
- **Free DNS** on the same account that owns the domain.
- **Resend Domain Connect** (“Sign in to Cloudflare”) is the lowest-friction SPF/DKIM path among options researched.
- **Vercel-compatible:** apex `A` (or Cloudflare CNAME flattening) + `www` `CNAME`; follow Vercel’s project Domains UI for exact targets.
- Porkbun remains the runner-up if Cloudflare’s “must use Cloudflare NS” constraint becomes undesirable, or if the desired TLD is unavailable at Cloudflare Registrar.

**Concrete product hostname is not locked in this doc** (Kyle picks the brand/TLD at purchase time). The **hostname plan pattern** below is binding.

---

## Hostname plan

One registered domain (illustrated as `example.com` — replace with the real product domain):

| Role | Host | Notes |
|------|------|--------|
| **App (public URL)** | Prefer `www.example.com` as primary, with apex `example.com` redirecting to `www` (Vercel’s recommended pattern) — **or** apex as primary if you strongly prefer bare domain | Set Production `AUTH_URL` to the canonical `https://…` host after Vercel attach |
| **Mail send** | Prefer subdomain, e.g. `send.example.com` (Resend default return-path style) | Resend best practice: send from a subdomain to isolate reputation from the web apex; verify that subdomain in Resend |
| **From address (post cutover)** | e.g. `Pick Six <noreply@send.example.com>` — prefer the verified send host; root/`noreply@example.com` only after apex SPF/MX audit | Override via Production `RESEND_FROM`; leave `DEFAULT_FROM` placeholder until cutover |

Same registration for web + mail. No separate email-only domain.

---

## Next DNS steps (by owner)

**Order:** complete §1 (web) before relying on product deep links in mail; complete §2 (email verify + `RESEND_FROM`) before production transactional sends; then §3 (smoke).

### 0 — Identify / acquire domain (Kyle, anytime; not gated by this story)

1. Buy **one** product domain at **Cloudflare Registrar** (confirm TLD support + renewal price at checkout).
2. Confirm nameservers: `dig NS <domain>` or [dns.email](https://dns.email) — should be Cloudflare NS after registration.
3. Zone uses Cloudflare NS automatically when registered there.

### 1 — Web — `post-epic-9-vercel-production-env-and-cron`

1. Vercel → Project → Settings → Domains → add apex and/or `www`.
2. Publish DNS at Cloudflare (copy **exact** targets from the Vercel Domains UI — do not reuse memorized IPs):
   - **Apex:** `A` (or CNAME flattening) to the target Vercel shows for this project.
   - **`www` (or other subdomain):** `CNAME` to the Vercel-provided target.
   - Set **app** apex/`www` records to **DNS Only** (grey cloud, not proxied) per Vercel’s Cloudflare guidance.
3. Wait for Vercel domain “Valid Configuration.” Enforce one canonical host (primary + redirect on the other) before setting `AUTH_URL`.
4. Set Production `AUTH_URL=https://<canonical-host>` (and any related Auth.js / absolute URL env).
5. Redeploy so the new env takes effect.
6. Confirm invite / digest deep links use the product host (not `*.vercel.app`).

### 2 — Email — `post-epic-9-resend-domain-and-from-address`

1. Inventory existing MX / SPF / DKIM on the zone (and on the chosen send subdomain). Prefer an unused send host (e.g. `send.`) so Resend does not conflict with workspace mail or a second apex SPF. **Do not** overwrite existing apex MX; **do not** publish multiple SPF TXT records at the same name.
2. Resend → Domains → add the **send** domain/subdomain (prefer `send.<product-domain>`).
3. Publish exact SPF / DKIM (/ MX for return-path) records Resend shows at Cloudflare.
   - Domain Connect **or** manual; set **mail-related** records to **DNS Only** (grey cloud, not proxied). Domain Connect / bulk import can accidentally orange-cloud records — re-check proxy status after publish.
4. Click Verify in Resend (often minutes; up to ~72 hours).
5. Set Production `RESEND_FROM` to the verified identity (e.g. `Pick Six <noreply@send.example.com>`).
6. Redeploy.
7. Do **not** mark cutover done until verify succeeds and a real send lands.

### 3 — Inbox smoke — `post-epic-9-production-smoke-test`

Gate on both Vercel “Valid Configuration” and Resend verified identity. Then: invite + Tuesday digest + reminders to a real inbox; confirm Resend dashboard.

---

## Sources

| Source | URL | Checked |
|--------|-----|---------|
| Cloudflare Registrar (at-cost product page) | https://www.cloudflare.com/products/registrar/ | 2026-07-28 |
| Cloudflare Registrar FAQ / at-cost model | https://www.cloudflare.com/learning/dns/what-is-cloudflare-registrar/ | 2026-07-28 |
| Porkbun domains / free WHOIS | https://porkbun.com/products/domains | 2026-07-28 |
| Namecheap domain prices | https://www.namecheap.com/domains/ | 2026-07-28 |
| Resend — Domains introduction | https://resend.com/docs/dashboard/domains/introduction | 2026-07-28 |
| Resend — Cloudflare (Domain Connect + DNS Only) | https://resend.com/docs/dashboard/domains/cloudflare | 2026-07-28 |
| Resend — Namecheap | https://resend.com/docs/knowledge-base/namecheap | 2026-07-28 |
| Vercel — Add a domain (apex `A`, subdomain `CNAME`) | https://vercel.com/docs/domains/working-with-domains/add-a-domain | 2026-07-28 |
| Pick Six email provider decision | [email-provider-decision.md](./email-provider-decision.md) | — |
| Pick Six deployment / go-live | [deployment.md](./deployment.md) | — |

---

## When to revisit

| Trigger | Action |
|---------|--------|
| Desired TLD unavailable at Cloudflare Registrar | Register at Porkbun; use Porkbun DNS (or Cloudflare DNS only if NS can point there) |
| Cloudflare Domain Connect fails | Fall back to manual Resend DNS records (still DNS Only) |
| Want non-Cloudflare NS while keeping low renewals | Prefer Porkbun over Namecheap for flat renewals |
| Considering GoDaddy promo | Decline — renewals conflict with max free / low-cost |
