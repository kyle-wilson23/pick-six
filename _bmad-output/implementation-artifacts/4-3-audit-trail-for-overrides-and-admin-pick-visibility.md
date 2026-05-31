# Story 4.3: Audit Trail for Overrides and Admin Pick Visibility

Status: done

## Story

As the system,
I want every admin pick change logged immutably,
So that disputes are resolvable (**FR32**, **FR33**, **NFR14**, **NFR18**, **NFR50**).

## Acceptance Criteria

1. **Audit entry written on every successful admin override**

   **Given** a league admin submits a successful pick override via `POST /api/leagues/[leagueId]/admin/picks`

   **When** the pick upsert commits

   **Then** an `audit_log_entries` row is created in the same transaction containing:
   - `leagueId` — league the override occurred in
   - `adminMembershipId` — membership ID of the actor (the league admin)
   - `targetMembershipId` — membership ID of the participant whose pick was changed
   - `nflWeekNumber` — the NFL week of the override
   - `beforeTeamId` — the team previously picked for that week, or `null` if no prior pick existed
   - `afterTeamId` — the team set by this override
   - `beforeAntiJailed` — the `antiJailedBonus` flag before the override, or `null` if no prior pick
   - `afterAntiJailed` — the `antiJailedBonus` flag set by this override
   - `createdAt` — DB-generated `@default(now())` timestamp

   **And** writing the audit entry is part of the same `prisma.$transaction` as the pick upsert — if either fails, both roll back

2. **Admin can list the audit log for a league**

   **Given** an authenticated league admin

   **When** they request `GET /api/leagues/[leagueId]/admin/audit-log`

   **Then** they receive an ordered list of audit entries for that league (most recent first), each containing:
   - `id`
   - `adminName` — display name or email of the admin who performed the override
   - `targetName` — display name or email of the participant whose pick was changed
   - `nflWeekNumber`
   - `beforeTeamName` (nullable — team name or `null` if first pick)
   - `afterTeamName`
   - `beforeAntiJailed` (nullable)
   - `afterAntiJailed`
   - `createdAt` (ISO string)

   **And** 401 is returned for unauthenticated callers, 403 for authenticated non-admins (**NFR16**)

3. **Pick data does not leak to non-admins via the audit log API**

   **Given** an authenticated participant with MEMBER role attempting to access `GET /api/leagues/[leagueId]/admin/audit-log`

   **When** the request is made

   **Then** 403 is returned — no audit data is exposed (**NFR17**, **FR49** at the API layer)

4. **Admin can view the audit log on the admin dashboard**

   **Given** the admin is viewing `/leagues/[leagueId]/admin`

   **When** there are audit log entries for the league

   **Then** a section below the submission status cards displays the audit trail — each entry shows: admin name, participant name, week, before team → after team (or "first pick" if no prior pick), and the timestamp

   **When** no override actions have occurred yet

   **Then** a helpful empty-state message is shown (e.g. "No override actions recorded yet")

5. **Audit entries are tamper-evident (application-level guarantee)**

   **Given** the `AuditLogEntry` model

   **Then** there is no UPDATE or DELETE endpoint exposed for audit entries — they are write-once at creation and cascade-deleted only when the parent league is deleted (**NFR14**, **NFR50**)

   **And** the `createdAt` timestamp is DB-generated (`@default(now())`) and never settable by the caller

---

## Tasks / Subtasks

- [x] **Schema: Add `AuditLogEntry` model to `prisma/schema.prisma`** (AC: #1, #5)
  - [x] Add model `AuditLogEntry` with fields: `id`, `leagueId`, `adminMembershipId`, `targetMembershipId`, `nflWeekNumber`, `beforeTeamId` (nullable String), `afterTeamId`, `beforeAntiJailed` (nullable Boolean), `afterAntiJailed`, `createdAt @default(now())`
  - [x] Add named relations to `LeagueMembership`: `adminMembership @relation("AuditAdmin", ...)` and `targetMembership @relation("AuditTarget", ...)`; use `onDelete: Restrict` (no member removal stories in MVP)
  - [x] Add `@relation` to `League` model: `auditLogEntries AuditLogEntry[]`; `leagueId` FK uses `onDelete: Cascade`
  - [x] Add named back-references to `LeagueMembership`: `auditEntriesAsAdmin AuditLogEntry[] @relation("AuditAdmin")` and `auditEntriesAsTarget AuditLogEntry[] @relation("AuditTarget")`
  - [x] Add index: `@@index([leagueId, createdAt(sort: Desc)])` for efficient paginated queries
  - [x] Add `@@map("audit_log_entries")`
  - [x] Run `npx prisma migrate dev --name add_audit_log_entries` to generate and apply migration
  - [x] Run `npx prisma generate` to update the client

- [x] **Update `src/lib/admin/submit-pick-on-behalf.ts`** (AC: #1)
  - [x] Before the `tx.pick.upsert`, capture the `existing` pick's `teamId` and `antiJailedBonus` — the `existing` variable is already fetched (`const existing = await tx.pick.findUnique(...)`) but currently only stores `{ id: true }`; expand the select to also include `teamId` and `antiJailedBonus` so the before-state is available
  - [x] After the `tx.pick.upsert`, write `await tx.auditLogEntry.create({ data: { leagueId, adminMembershipId, targetMembershipId, nflWeekNumber, beforeTeamId: existing?.teamId ?? null, afterTeamId: teamId, beforeAntiJailed: existing?.antiJailedBonus ?? null, afterAntiJailed: antiJailedBonus } })`
  - [x] The audit write must remain inside the same transaction (`tx`) — no separate `prisma.auditLogEntry.create` outside the transaction
  - [x] `adminMembershipId` is already an arg (added in Story 4.2 specifically for this); now use it

- [x] **Update test: `src/lib/admin/submit-pick-on-behalf.test.ts`** (AC: #1)
  - [x] Add `mockAuditLogCreate = vi.fn()` to the mock `createTx()` factory: `auditLogEntry: { create: mockAuditLogCreate }`
  - [x] Update `mockPickFindUnique` in "existing pick → 200, pick updated" test to return `{ id: 'pick-1', teamId: 'team-away', antiJailedBonus: false }` (before state)
  - [x] Add assertion: on success (both 201 and 200 paths) `mockAuditLogCreate` is called once with `{ data: { leagueId, adminMembershipId, targetMembershipId, nflWeekNumber, beforeTeamId: ..., afterTeamId: ..., beforeAntiJailed: ..., afterAntiJailed: ... } }`
  - [x] Add assertion: on error paths (duplicate, jailed, not found) `mockAuditLogCreate` is NOT called

- [x] **New query lib: `src/lib/admin/get-audit-log.ts`** (AC: #2)
  - [x] Export `AuditLogEntryView` type: `{ id, adminName, targetName, nflWeekNumber, beforeTeamName: string | null, afterTeamName, beforeAntiJailed: boolean | null, afterAntiJailed, createdAt: string }`
  - [x] Export `getAuditLog(args: { leagueId: string }, db?: PrismaClient): Promise<AuditLogEntryView[]>`
  - [x] Query: `db.auditLogEntry.findMany({ where: { leagueId }, orderBy: { createdAt: 'desc' }, include: { adminMembership: { include: { user: { select: { name: true, email: true } } } }, targetMembership: { include: { user: { select: { name: true, email: true } } } }, afterTeam: { select: { name: true } } }, select: { id, nflWeekNumber, beforeTeamId, afterTeamId, beforeAntiJailed, afterAntiJailed, createdAt } })`
  - [x] For `beforeTeamName`: if `beforeTeamId` is not null, perform a separate lookup or include the `beforeTeam` relation — see Dev Notes for the relation name approach
  - [x] Resolve display name: `user.name ?? user.email` (same pattern as `AdminSubmissionCard` source)
  - [x] Serialize `createdAt` to ISO string (`createdAt.toISOString()`)
  - [x] Accept optional `db` param defaulting to `prisma` singleton (same pattern as `buildAdminOverrideData`)

- [x] **New API route: `src/app/api/leagues/[leagueId]/admin/audit-log/route.ts`** (AC: #2, #3)
  - [x] `GET` handler only (no mutation endpoint — entries are write-once)
  - [x] No CSRF check needed (GET is idempotent/safe)
  - [x] `auth()` → 401 if no session
  - [x] Load `prisma.leagueMembership.findUnique({ where: { userId_leagueId: { userId, leagueId } } })` → 403 if not found or `role !== ADMIN`
  - [x] Call `getAuditLog({ leagueId })`
  - [x] Return `NextResponse.json({ entries })` with status 200
  - [x] Wrap in try/catch; return 500 on unexpected errors

- [x] **New UI component: `src/components/admin/AdminAuditLog.tsx`** (AC: #4)
  - [x] Server component (no `"use client"` — no interactivity required; rendered from the server page)
  - [x] Props: `{ entries: AuditLogEntryView[] }`
  - [x] Section heading: `Typography variant="h6"` — "Override Audit Trail"
  - [x] If `entries.length === 0`: render `Typography color="text.secondary"` — "No override actions recorded yet."
  - [x] Otherwise, render MUI `Stack` of `Paper`-wrapped rows (or `List`/`ListItem`)
  - [x] Each entry: `Stack direction="row"` (or `Typography`)
    - Left: `"[adminName] changed [targetName]'s pick (Week [N])"` or `"[adminName] submitted first pick for [targetName] (Week [N])"` when `beforeTeamName` is null
    - Right: `"[beforeTeamName] → [afterTeamName]"` or `"→ [afterTeamName]"` if no before; include `"(+anti-jailed)"` next to afterTeamName if `afterAntiJailed`
    - Below: timestamp in `Typography variant="caption" color="text.secondary"` — format as `new Date(createdAt).toLocaleString()` — acceptable for a server-side render since this is an admin-only view with known locale needs
  - [x] Use **`Stack`** for flex layouts (not `Box`) per user rules
  - [x] Keep visual weight light — this is tertiary info per UX spec; use `elevation={0}` or `variant="outlined"` Paper

- [x] **Update `src/app/(app)/leagues/[leagueId]/admin/page.tsx`** (AC: #4)
  - [x] Import `getAuditLog` and `AdminAuditLog`
  - [x] Add `getAuditLog({ leagueId })` to the existing `Promise.all` parallel fetch: `const [payload, overrideData, auditEntries] = await Promise.all([buildSubmissionStatus(...), buildAdminOverrideData(...), getAuditLog({ leagueId })])`
  - [x] Render `<AdminAuditLog entries={auditEntries} />` below the submission status / dashboard client section

- [x] **`npm test` green; `npm run lint` / `npm run build`** before closing

### Review Findings

- [x] [Review][Patch] `buildTeamChangeLine` missing "first pick" label for no-prior-pick case — AC4 requires "before → after (or 'first pick' if no prior pick)" but bare `→ afterTeam` appears instead [`src/components/admin/AdminAuditLog.tsx:28-30`]
- [x] [Review][Patch] `beforeAntiJailed` not reflected in team-change before-state — admin cannot see if override removed the anti-jailed bonus [`src/components/admin/AdminAuditLog.tsx:23-33`]
- [x] [Review][Patch] Anti-jailed success path test (→ 201) missing `mockAuditLogCreate` assertion — AC1 requires audit on every successful override [`src/lib/admin/submit-pick-on-behalf.test.ts`]
- [x] [Review][Patch] Post-deadline and firstCompetitionWeek lock success tests missing audit log assertions — two more 201 paths uncovered by AC1 [`src/lib/admin/submit-pick-on-behalf.test.ts`]
- [x] [Review][Defer] No pagination/limit on `getAuditLog` unbounded `findMany` [`src/lib/admin/get-audit-log.ts:23`] — deferred, pre-existing pattern; pagination is a future story
- [x] [Review][Defer] RESTRICT FK on membership deletes will block future member-removal features [`prisma/schema.prisma`, `migration.sql`] — deferred, pre-existing; explicitly documented; no MVP removal story
- [x] [Review][Defer] Missing secondary index on `adminMembershipId` for future "overrides by admin" queries [`prisma/schema.prisma`] — deferred, pre-existing; no current query needs it
- [x] [Review][Defer] Update test asserts same team ID before and after — weak change coverage [`src/lib/admin/submit-pick-on-behalf.test.ts`] — deferred, test quality improvement; AC1 coverage exists
- [x] [Review][Defer] Email fallback in `adminName`/`targetName` exposes PII in admin UI [`src/lib/admin/get-audit-log.ts:36-37`] — deferred, admin-only view; future GDPR/privacy story scope
- [x] [Review][Defer] `adminMembershipId` function parameter not validated to calling session user [`src/lib/admin/submit-pick-on-behalf.ts`] — deferred, theoretical; route correctly fetches membership from DB before calling
- [x] [Review][Defer] `AuditLogEntryView.createdAt` typed as `string` — serialization happens inside data layer instead of at API boundary [`src/lib/admin/get-audit-log.ts`] — deferred, intentional RSC-serializable design choice

---

## Dev Notes

### Schema: `AuditLogEntry` Model

```prisma
// prisma/schema.prisma — add after the Pick model

/// Immutable record of every admin pick override (Story 4.3; FR32, NFR14, NFR50).
/// Written in the same transaction as the pick upsert inside submitPickOnBehalf.
/// No UPDATE/DELETE endpoints exist — tamper-evidence at the application layer.
model AuditLogEntry {
  id                 String   @id @default(cuid())
  leagueId           String   @map("league_id")
  adminMembershipId  String   @map("admin_membership_id")
  targetMembershipId String   @map("target_membership_id")
  nflWeekNumber      Int      @map("nfl_week_number")
  /// Null if this override created the pick for the week (no prior pick existed)
  beforeTeamId       String?  @map("before_team_id")
  afterTeamId        String   @map("after_team_id")
  /// Null if this override created the pick (no prior pick existed)
  beforeAntiJailed   Boolean? @map("before_anti_jailed")
  afterAntiJailed    Boolean  @map("after_anti_jailed")
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz

  league           League           @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  /// onDelete: Restrict — no member removal stories in MVP; prevents orphan audit rows
  adminMembership  LeagueMembership @relation("AuditAdmin", fields: [adminMembershipId], references: [id], onDelete: Restrict)
  targetMembership LeagueMembership @relation("AuditTarget", fields: [targetMembershipId], references: [id], onDelete: Restrict)
  /// Team relations — Restrict: team rows are global and never deleted in MVP
  beforeTeam       Team?            @relation("AuditBeforeTeam", fields: [beforeTeamId], references: [id], onDelete: Restrict)
  afterTeam        Team             @relation("AuditAfterTeam", fields: [afterTeamId], references: [id], onDelete: Restrict)

  @@index([leagueId, createdAt(sort: Desc)])
  @@map("audit_log_entries")
}
```

**Updates to existing models** — add back-relations (Prisma requires both sides of a relation):

```prisma
model League {
  // ... existing fields ...
  auditLogEntries AuditLogEntry[]
}

model LeagueMembership {
  // ... existing fields ...
  auditEntriesAsAdmin  AuditLogEntry[] @relation("AuditAdmin")
  auditEntriesAsTarget AuditLogEntry[] @relation("AuditTarget")
}

model Team {
  // ... existing fields ...
  auditEntriesAsBefore AuditLogEntry[] @relation("AuditBeforeTeam")
  auditEntriesAsAfter  AuditLogEntry[] @relation("AuditAfterTeam")
}
```

### `submitPickOnBehalf` — Before State Capture + Audit Write

The `existing` pick lookup currently selects only `{ id: true }`. Expand to include before state, then write the audit entry in the same `tx`:

```ts
const existing = await tx.pick.findUnique({
  where: {
    leagueMembershipId_seasonId_nflWeekNumber: {
      leagueMembershipId: targetMembershipId,
      seasonId: season.id,
      nflWeekNumber,
    },
  },
  select: { id: true, teamId: true, antiJailedBonus: true }, // expanded for Story 4.3
});
const isCreate = !existing;

// ... firstCompetitionWeek lock logic (unchanged) ...

const saved = await tx.pick.upsert({ ... }); // unchanged

// Story 4.3: write audit log in same transaction
await tx.auditLogEntry.create({
  data: {
    leagueId,
    adminMembershipId,           // already in args from Story 4.2
    targetMembershipId,
    nflWeekNumber,
    beforeTeamId: existing?.teamId ?? null,
    afterTeamId: teamId,
    beforeAntiJailed: existing?.antiJailedBonus ?? null,
    afterAntiJailed: antiJailedBonus,
  },
});

return { type: "ok", status: isCreate ? 201 : 200, body: { pick: { ... } } };
```

### `getAuditLog` — Team Name Resolution

`beforeTeamId` is nullable, so we cannot rely on Prisma `include: { beforeTeam: ... }` loading a team for all rows when some have `beforeTeamId = null`. Prisma handles optional relations fine (`beforeTeam` will be `null` when `beforeTeamId` is null). Use the named relation:

```ts
const entries = await db.auditLogEntry.findMany({
  where: { leagueId },
  orderBy: { createdAt: "desc" },
  include: {
    adminMembership: { include: { user: { select: { name: true, email: true } } } },
    targetMembership: { include: { user: { select: { name: true, email: true } } } },
    beforeTeam: { select: { name: true } },   // null when beforeTeamId is null
    afterTeam: { select: { name: true } },
  },
});

return entries.map((e) => ({
  id: e.id,
  adminName: e.adminMembership.user.name ?? e.adminMembership.user.email,
  targetName: e.targetMembership.user.name ?? e.targetMembership.user.email,
  nflWeekNumber: e.nflWeekNumber,
  beforeTeamName: e.beforeTeam?.name ?? null,
  afterTeamName: e.afterTeam.name,
  beforeAntiJailed: e.beforeAntiJailed,
  afterAntiJailed: e.afterAntiJailed,
  createdAt: e.createdAt.toISOString(),
}));
```

### API Route — No CSRF on GET

The `GET /api/leagues/[leagueId]/admin/audit-log` route does NOT call `assertCookieSessionMutationOrigin`. That guard is for state-changing POST/PUT/DELETE routes. GET is safe/idempotent.

Admin auth guard pattern is identical to `submission-status/route.ts` and the `picks/route.ts`:

```ts
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
}
const { leagueId } = await context.params;
const membership = await prisma.leagueMembership.findUnique({
  where: { userId_leagueId: { userId: session.user.id, leagueId } },
});
if (!membership || membership.role !== LeagueMembershipRole.ADMIN) {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin role required" } }, { status: 403 });
}
```

### Parallel Data Fetch in `page.tsx`

Extend the existing `Promise.all` call:

```ts
const [payload, overrideData, auditEntries] = await Promise.all([
  buildSubmissionStatus({ leagueId }),
  buildAdminOverrideData({ leagueId }),
  getAuditLog({ leagueId }),
]);
```

`getAuditLog` always returns an array (empty if none). No null-check needed before passing to `AdminAuditLog`.

### `AdminAuditLog` — Server Component

`AdminAuditLog.tsx` does NOT need `"use client"`. It receives serializable data from the server page and renders static HTML. This keeps it lean and avoids the client bundle cost.

No `router.refresh()` needed here — the audit log updates after each override through the existing `router.refresh()` call in `AdminDashboardClient.onSuccess`.

### Tamper-Evident Guarantee (NFR14)

The application-layer guarantee for tamper-evidence:
1. No `updateAuditLogEntry` or `deleteAuditLogEntry` endpoints exist or will be created
2. `createdAt` uses `@default(now())` — set by the DB, not the application caller
3. `onDelete: Cascade` from `League` is the only deletion path — destroying the entire league clears its audit trail, which is the expected behavior (no orphan data)
4. Add a JSDoc comment in the model and in `submitPickOnBehalf` documenting these guarantees

Note: True cryptographic tamper-evidence (hash chaining, etc.) is out of scope for MVP.

### No Rate Limiting on the Audit Log GET

Consistent with other admin-only read endpoints (`submission-status/route.ts`). Admin GET routes are low-frequency and gated behind session + role check. No `proxy.ts` change needed.

### File Locations

| Area | File |
|------|------|
| Schema | `prisma/schema.prisma` |
| Migration | `prisma/migrations/<timestamp>_add_audit_log_entries/migration.sql` (auto-generated) |
| Mutation lib (update) | `src/lib/admin/submit-pick-on-behalf.ts` |
| Mutation test (update) | `src/lib/admin/submit-pick-on-behalf.test.ts` |
| Query lib (new) | `src/lib/admin/get-audit-log.ts` |
| API route (new) | `src/app/api/leagues/[leagueId]/admin/audit-log/route.ts` |
| UI component (new) | `src/components/admin/AdminAuditLog.tsx` |
| Admin page (update) | `src/app/(app)/leagues/[leagueId]/admin/page.tsx` |

### Deferred Work from Story 4.2 That This Story Resolves

From `_bmad-output/implementation-artifacts/deferred-work.md`:
> **[Review][Defer] Audit trail for `adminMembershipId`** — intentionally deferred to Story 4.3 per Dev Notes [submit-pick-on-behalf.ts:45]

This story implements that deferred item by writing the audit log using the `adminMembershipId` param that was added in 4.2 specifically for this purpose.

### Imports to Reuse

```ts
// In get-audit-log.ts
import { prisma } from "@/lib/db";

// In audit-log/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeagueMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuditLog } from "@/lib/admin/get-audit-log";

// In page.tsx additions
import { getAuditLog } from "@/lib/admin/get-audit-log";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
```

### No New Zod Schema Needed

The GET endpoint has no body (query params are not used — returns all entries for the league). No `adminPickBodySchema`-style schema needed for this route.

### Testing Focus

- Unit test the updated `submitPickOnBehalf`: verify audit entry is written on success (both create and update paths), NOT written on error paths.
- No unit tests required for `getAuditLog` or the route handler (consistent with `buildSubmissionStatus` and `submission-status/route.ts` which have no route-level tests in this codebase).
- `npm test` must pass green; lint and build clean.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.3 AC + FR32, FR33, FR49, NFR14, NFR17, NFR18, NFR50]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR32, FR33, NFR14, NFR18, NFR50 definitions; PRD journey noting "system logs the action with a timestamp"]
- [Source: `_bmad-output/implementation-artifacts/4-2-submit-or-change-pick-on-behalf-including-post-deadline.md` — Dev Notes: "adminMembershipId Parameter — Future-Proofing for Story 4.3"; deferred item: audit trail]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — 4.2 deferred: "Audit trail for adminMembershipId — intentionally deferred to Story 4.3"]
- [Source: `src/lib/admin/submit-pick-on-behalf.ts` — existing mutation to augment with audit write]
- [Source: `src/lib/admin/submit-pick-on-behalf.test.ts` — test file to augment with audit assertions]
- [Source: `src/lib/admin/build-admin-override-data.ts` — module structure template; prisma singleton pattern]
- [Source: `src/app/api/leagues/[leagueId]/admin/submission-status/route.ts` — admin auth guard pattern for the GET route]
- [Source: `src/app/(app)/leagues/[leagueId]/admin/page.tsx` — Promise.all fetch pattern to extend]
- [Source: `prisma/schema.prisma` — existing models; @map, @db.Timestamptz, onDelete: Restrict/Cascade conventions]
- [Source: `docs/project-context.md` — non-negotiables #5 (audit trail), #2 (Prisma singleton), #6 (naming), #7 (error shape); MUI Stack for flex]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — "tertiary (two taps away)" placement for audit trails; "monitoring dashboard: submission status, pick distribution, override audit trail" (line 875)]

---

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Migration applied via `npx prisma migrate dev --name add_audit_log_entries` (20260531023131_add_audit_log_entries)

### Completion Notes List

- Added immutable `AuditLogEntry` model with league cascade delete, membership/team restrict FKs, and `(leagueId, createdAt DESC)` index.
- `submitPickOnBehalf` now captures before-state from existing pick and writes audit row in the same transaction after upsert.
- Extended unit tests: audit create on 201/200 success paths; no audit on duplicate/jailed/not-found errors.
- Added `getAuditLog` query lib, `GET /api/leagues/[leagueId]/admin/audit-log` (admin-only, no CSRF), and `AdminAuditLog` server component on admin dashboard.
- Resolves Story 4.2 deferred item: audit trail for `adminMembershipId`.
- `npm test`: 227 passed. `npm run build`: success. Pre-existing lint errors in `AdminPickOverrideDialog.tsx` (Story 4.2) unchanged.

### File List

- prisma/schema.prisma
- prisma/migrations/20260531023131_add_audit_log_entries/migration.sql
- src/lib/admin/submit-pick-on-behalf.ts
- src/lib/admin/submit-pick-on-behalf.test.ts
- src/lib/admin/get-audit-log.ts
- src/app/api/leagues/[leagueId]/admin/audit-log/route.ts
- src/components/admin/AdminAuditLog.tsx
- src/app/(app)/leagues/[leagueId]/admin/page.tsx

### Change Log

- 2026-05-30: Story 4.3 — audit trail for admin pick overrides (schema, mutation, API, dashboard UI)
