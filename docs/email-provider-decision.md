# Transactional email provider decision (Pre-Epic 6 spike)

**Investigation:** July 2026 (web + vendor docs). **Pricing and tiers change** — confirm on each vendor's site before contracts or capacity planning.

## What we optimized for

| Priority | Rationale |
|----------|-----------|
| **Max free tier (production-viable)** | Architecture constraint: "max free tier" for all external services at MVP scale. Provider must offer a permanent free quota large enough to cover realistic pick-six volume. |
| **React / TypeScript DX** | Project is Next.js + React + TypeScript. A TypeScript-first SDK that integrates naturally with React Email templates reduces friction and keeps the codebase consistent. |
| **NFR alignment** | NFR27 (failure logging + retry), NFR32 (delivery confirmation tracking), NFR33 (exponential backoff + idempotency), NFR34 (Tuesday 6 PM ET weekly cadence). |
| **Predictable upgrade path** | If volume grows beyond MVP, the cost jump should be documented and predictable — no surprise billing model. |

## Options investigated

| Provider | Free tier | Key facts | Pick-six fit |
|----------|-----------|-----------|--------------|
| **[Resend](https://resend.com)** | **3,000/month, 100/day (permanent)** | TypeScript-first SDK; React Email native integration (JSX templates); built on SES; Y Combinator–backed; 5-min setup; $20/mo for 50k | ✅ **Selected** — free tier covers MVP, React/Next.js native, cleanest DX |
| **[Postmark](https://postmarkapp.com)** | 100/month (dev/testing only, not production) | Best deliverability (~99%); own MTA layer; 45-day log retention; $15/mo for 10k; no viable free production tier | ❌ No free production tier; overkill at MVP scale |
| **[SendGrid](https://sendgrid.com)** | ~~100/day permanent~~ → **60-day trial only** (changed May 2025) | Twilio ecosystem; enterprise scale; removed permanent free tier; $19.95/mo | ❌ Free tier eliminated — fails the cost constraint |
| **[Mailgun](https://mailgun.com)** | Limited trial only; $15/mo for 10k | Solid legacy reputation; older API design | ❌ No meaningful free tier |
| **[Brevo](https://brevo.com)** | 300/day (permanent) | EU data residency; combined marketing + transactional; older API design | ⚠️ Alternative if Resend proves insufficient; lower daily cap |

## Recommendation: Resend

**Rationale:**

- Only provider with a **genuinely production-usable permanent free tier** (3,000/month). At early MVP scale — e.g. 10 leagues × 15 participants × 4 emails/week = 600/week ≈ 2,400/month — there is comfortable headroom. The free tier is exhausted at ~750 sends/week sustained (3,000/month ÷ 4 weeks ≈ 6–7 active leagues). At 50 leagues the monthly volume (~12,000/month) exceeds the free cap and requires the $20/month Pro tier.
- **React Email** integration lets email templates be authored as React components — consistent with the project's Next.js + React stack. Templates live as `.tsx` files; no separate templating language.
- **TypeScript-first SDK**: `npm install resend`, `import { Resend } from "resend"` — no wrapper gymnastics.
- Supports **idempotency keys** on the send endpoint (NFR33): safe retries without duplicate delivery.
- **Webhook events** for `email.delivered` and `email.bounced` — supports NFR32 delivery confirmation tracking.
- **Predictable upgrade path**: $20/month unlocks 50,000 emails — cost is visible before you incur it.

**Why not Postmark?**
Postmark has the industry's best deliverability track record (~99%), but its production minimum ($15/month) violates the "max free tier" architecture constraint. For pick-six's use case (weekly non-critical reminder emails, not financial or safety alerts), Resend's deliverability is adequate. Revisit Postmark if the project scales beyond ~100 leagues.

**Why not SendGrid?**
SendGrid removed its permanent free tier in May 2025. New accounts get a 60-day trial, then require a paid plan ($19.95/month minimum). No longer viable as the free-tier choice.

## Free tier limits and upgrade path

| Tier | Monthly sends | Daily cap | Cost |
|------|--------------|-----------|------|
| Free (permanent) | 3,000 | 100 | $0 |
| Pro ($20/mo) | 50,000 | — | $20/mo |
| Pro ($35/mo) | 100,000 | — | $35/mo |

**Daily cap is the binding constraint:** The free tier caps at **100 emails/day**, not just 3,000/month. At 15 participants per league, the daily cap is exhausted at ~6 active leagues sending on the same day (6 × 15 = 90 ≤ 100; 7 × 15 = 105 > 100). Beyond ~6 leagues, sends must be staggered across hours or days — implementation delegated to Story 6.5.

**Trigger to upgrade:** If active weekly email volume approaches 2,500/month (83% of monthly cap), or if any single send day approaches 85 emails (85% of daily cap), move to the $20/month Pro tier before launch risk materializes. At that threshold the cost is predictable and the upgrade is self-serve.

## SDK quick-reference for Story 6.1

### Prerequisites

Before Story 6.1 can send to real recipients, **verify your sending domain with Resend**. Domain verification requires adding DNS records (SPF, DKIM). DNS propagation can take up to 48 hours — initiate verification before Story 6.1 begins, not during it.

Steps: [Resend domain setup docs](https://resend.com/docs/dashboard/domains/introduction) → add domain → copy DNS records → add to your DNS provider.

### Installation

```bash
npm install resend react-email
```

### Environment variable

```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"
```

Name `RESEND_API_KEY` — consistent with Resend's SDK defaults and their own docs. Add to `.env.local` (development) and set as a Vercel environment variable for staging/production. **Never commit the key.**

### Send call shape

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "Pick Six <noreply@yourdomain.com>",
  to: ["participant@example.com"],
  subject: "Your week 7 picks are due Thursday",
  react: <PickReminderEmail participant={participant} week={week} />,
  idempotencyKey: `reminder-${leagueId}-${weekNumber}-${participantId}`, // NFR33
});
```

> **Note:** The `react` property requires JSX. The caller file must use a `.tsx` extension (or have `jsx` enabled in `tsconfig.json`). `resend-client.ts` should be `.tsx` if it renders templates inline, or templates can be pre-rendered in a separate `.tsx` helper.

### Idempotency keys (NFR33)

Compose idempotency keys from stable, per-action identifiers: `` `${type}-${leagueId}-${weekNumber}-${participantId}` ``. The Resend API deduplicates sends with the same key within a rolling window — safe to retry on transient failures without duplicate delivery.

### Error handling pattern (NFR27)

```typescript
try {
  const { data, error } = await resend.emails.send({ /* ... */ });
  if (error) {
    console.error("[email] send failed", { error, to: toAddress, week: weekNumber });
    throw new Error(`Email send failed: ${error?.message ?? JSON.stringify(error)}`);
  }
} catch (err) {
  console.error("[email] send threw", { err, to: toAddress, week: weekNumber });
  throw err; // caller's retry loop handles this (NFR33)
}
```

Wrap the caller in a retry loop with exponential backoff for NFR33. Story 6.1 owns the retry implementation. The `try/catch` is necessary because the SDK can throw synchronously (e.g. network timeout) before returning the `{ data, error }` tuple.

## Existing stub

`src/lib/email/send-invitation-email.ts` already exists with a `console.info` stub and the comment "Epic 6 will add a real provider." Story 6.1 must wire the **existing function** to Resend's SDK — do not create a parallel path.

Expected file structure after Story 6.1 (for context — do not implement in 6.1 preemptively):

```
src/lib/email/
  app-base-url.ts           (exists — no change)
  send-invitation-email.ts  (exists — stub; Story 6.1 wires to Resend)
  resend-client.ts          (Story 6.1 — thin Resend SDK wrapper)
```

## Cron strategy for Vercel Hobby

### Constraint

Vercel Hobby cron jobs fire **at most once per calendar day**, with **±1 hour precision**. Sub-daily schedules require Vercel Pro or an external scheduler.

### Email schedule required by Epic 6

| Day | Time (ET) | Purpose | FR |
|-----|-----------|---------|-----|
| Tuesday | ~6:00 PM | League digest | FR35 |
| Wednesday | Evening | Reminder: no-pick participants | FR37 |
| Thursday | ~1 hr before 9:10 PM deadline | Final reminder | FR38 |

### Recommended approach: one cron per day-of-week + Eastern time gate

Use `vercel.json` cron schedules targeting the approximate UTC hour. Handlers check `America/New_York` time before executing to handle DST gracefully.

| Day | `vercel.json` schedule | UTC target | ET equivalent | Notes |
|-----|------------------------|------------|---------------|-------|
| Tuesday | `"0 22 * * 2"` | 22:00 UTC | 5:00 PM ET (standard) / 6:00 PM ET (daylight) | NFR34 target; ±1 hr Hobby drift means 4–7 PM ET window |
| Wednesday | `"0 2 * * 4"` | 02:00 UTC Thu | 9:00 PM ET (standard) / 10:00 PM ET (daylight) | Fires after midnight UTC = still "Wednesday night" ET |
| Thursday | `"0 0 * * 5"` | 00:00 UTC Fri | 7:00 PM ET (standard) / 8:00 PM ET (daylight) | ~2 hrs before 9:10 PM ET deadline (standard) / ~1 hr (daylight) |

### Daylight saving time handling

Store all times as UTC instants. Use `Intl.DateTimeFormat` with the `America/New_York` timezone in handler logic to determine whether the current time falls within the intended window (e.g., "is it Tuesday after 5 PM ET and before midnight?"), rather than relying on the cron firing at an exact UTC offset.

```typescript
const now = new Date();
const etHour = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(now)
);
const etDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
}).format(now);

if (etDay !== "Tuesday" || etHour < 17) {
  return NextResponse.json({ skipped: true, reason: "outside ET window" });
}
```

Apply the same pattern for Wednesday and Thursday handlers — only the day name and hour lower-bound change:

```typescript
// Wednesday handler (cron "0 2 * * 4", fires 9–10 PM ET)
if (etDay !== "Wednesday" || etHour < 21) {
  return NextResponse.json({ skipped: true, reason: "outside ET window" });
}

// Thursday handler (cron "0 0 * * 5", fires 7–8 PM ET)
if (etDay !== "Thursday" || etHour < 19) {
  return NextResponse.json({ skipped: true, reason: "outside ET window" });
}
```

The Thursday lower bound of 19 (7 PM ET) is conservative. During EDT the cron fires at 20:00 ET (8 PM); during EST it fires at 19:00 ET (7 PM) — both are within the guard.

### Idempotency requirement

**Every Epic 6 email job handler must be idempotent**: running it twice for the same week must produce exactly one set of emails sent, not two. Implement a sent-flag approach on a per-week, per-league-membership basis.

Story 6.5 ("Cron routes, secrets, and idempotent weekly orchestration") owns the idempotency mechanism and the `CRON_SECRET`-protected route pattern. Email handlers in Stories 6.2 and 6.3 must be written to accept and honor that sent-flag.

Because Hobby has ±1 hour drift, **the Tuesday 6:00 PM ET target (NFR34) is best effort** — the cron fires in the 5–7 PM ET window. Handlers must treat this as a normal operational condition, not an error.

### Alternative if Hobby drift is unacceptable

Use an external free cron service (e.g., [cron-job.org](https://cron-job.org)) to `POST` a `CRON_SECRET`-protected `/api/cron/*` route. Epic 6.5 specifies this as the architecture's named alternative. The decision is deferred to Story 6.5 — this spike only documents the tradeoffs.

## NFR alignment for Story 6.1

| NFR | Requirement | Resend capability |
|-----|-------------|-------------------|
| NFR27 | Email delivery failures must be logged and retried | SDK returns typed `{ data, error }` tuple; wrap in try/catch with `console.error` + retry loop |
| NFR32 | Delivery confirmations must be tracked and logged | Resend webhook events: `email.delivered`, `email.bounced` — Story 6.x registers the webhook endpoint |
| NFR33 | Failed sends must retry with exponential backoff | Implement in caller; Resend SDK supports idempotency keys to prevent duplicate sends on retry |
| NFR34 | Weekly emails by 6:00 PM Tuesday | Vercel Hobby cron `0 22 * * 2` + ET gate check in handler |

## When to re-open provider choice

| Trigger | Action |
|---------|--------|
| Monthly send volume approaches 2,500 (83% of free cap) | Upgrade to Resend $20/month Pro tier (self-serve) |
| Resend free tier removed, quota cut, or repeated production failures | Evaluate Brevo (300/day free, permanent) as next-cheapest free-tier alternative |
| Deliverability becomes a business priority (growth beyond hobby scale) | Spike Postmark ($15/month); deliverability track record justifies cost at that point |
| Project consolidates to a paid budget | Re-evaluate SendGrid or Postmark with explicit cost approval |

## Sources

- [Resend pricing](https://resend.com/pricing) — verified July 2026
- [Resend SDK docs](https://resend.com/docs/send-with-nextjs) — TypeScript / Next.js integration
- [React Email](https://react.email/) — JSX-based email template library, native Resend integration
- [Postmark pricing](https://postmarkapp.com/pricing) — verified July 2026
- [SendGrid pricing](https://sendgrid.com/pricing) — free tier removal confirmed May 2025 change, verified July 2026
- [Mailgun pricing](https://mailgun.com/pricing) — verified July 2026
- [Brevo pricing](https://brevo.com/pricing) — verified July 2026
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby tier one-cron-per-day constraint confirmed
- [cron-job.org](https://cron-job.org) — free external scheduler (fallback option documented in Epic 6.5)
- `_bmad-output/implementation-artifacts/epic-5-retro-2026-06-16.md` — action item 5 mandating this spike
- `_bmad-output/planning-artifacts/architecture.md` — "max free tier" constraint, background/scheduled work section
- `_bmad-output/planning-artifacts/epics.md` — Epic 6 goal and Story 6.1 / 6.5 acceptance criteria
- `_bmad-output/planning-artifacts/prd.md` — FR35–FR40, NFR27, NFR32, NFR33, NFR34
