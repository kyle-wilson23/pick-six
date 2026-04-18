# Story 2.8: Admin delete league (production)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a league admin,
I want to **permanently delete** a league I administer from **league settings** (same admin surface as **FR5** / Story **2.4**),
So that I can remove a mistaken or obsolete league without contacting support (**FR61**).

## Acceptance Criteria

1. **Given** an authenticated user with **`LeagueMembershipRole.ADMIN`** for league **L**  
   **When** they open **`/leagues/[leagueId]/settings`**  
   **Then** they see a **Delete league** entry (destructive **`error`** / red **`Button`** treatment per UX — not a casual secondary control) that starts the delete flow.

2. **Given** the admin clicks **Delete league**  
   **When** the flow opens  
   **Then** a **modal dialog** explains that deletion is **permanent**, that **league-scoped data** (members, seasons, invitations, and any future league-scoped rows per schema) will be removed, and displays the **exact league name** (from server-rendered props — **no client-only trust**).

3. **Given** the confirmation dialog  
   **When** the admin has **not** typed the exact lowercase word **`delete`** into the confirmation field  
   **Then** the primary confirm control (**Delete permanently** or equivalent) is **disabled** (or no-ops if somehow invoked).

4. **Given** the admin types **`delete`** exactly (lowercase) and confirms  
   **When** the client calls the server delete endpoint with **same-origin / CSRF posture** as other league mutations (**`assertCookieSessionMutationOrigin`** on **`DELETE`**)  
   **Then** the league row is removed and **dependent data** is removed per **Prisma `onDelete: Cascade`** (see Dev Notes for current models); **`User`** rows remain if they have other leagues or no league dependency.

5. **Given** success  
   **When** the mutation completes  
   **Then** the admin is taken to a **safe** destination (e.g. **`/leagues`** — administered list) with no further requests to the deleted **`leagueId`**; a brief **success** affordance (snackbar or inline message on the list page) is optional, not required.

6. **Given** a caller who is **not** an admin for **L**  
   **When** they **`DELETE`** the endpoint  
   **Then** the API returns **403** with **`{ error: { code, message } }`** (e.g. **`FORBIDDEN`**).

7. **Given** an **unauthenticated** caller  
   **When** they **`DELETE`** the endpoint  
   **Then** the API returns **401** with structured error (**`UNAUTHENTICATED`** or project-consistent code).

8. **Given** a stale client (league already deleted) or unknown id  
   **When** **`DELETE`** runs  
   **Then** return **404** with structured error (e.g. **`LEAGUE_NOT_FOUND`**) — **idempotent-friendly**: deleting twice should not 500.

9. **Optional (recommended):** Log a **structured** line (e.g. `console.info` / logger) with **`leagueId`**, **`actorUserId`**, **timestamp**, and action **`league_deleted`** — no secrets; supports accountability until a dedicated **`audit_log_entries`** table exists (**Epic 4**).

10. **Product boundary:** This is **FR61** **production** delete — **not** gated on “test league” flags. **Epic 8 / Story 8.7** may reuse the same API + UX pattern for rehearsal cleanup; do **not** require **`isTestLeague`** for this story.

## Tasks / Subtasks

- [x] **API — `DELETE /api/leagues/[leagueId]`** — Add **`src/app/api/leagues/[leagueId]/route.ts`** exporting **`DELETE`** only (unless the repo already uses this file for something else — if so, extend consistently):
  - Call **`assertCookieSessionMutationOrigin(request)`** first after any trivial parse (same order family as **`pre-season-init`**: no auth bypass before origin check).
  - **`auth()`** → **401** if no session user.
  - Load **`leagueMembership`** for **`userId` + `leagueId`** → **403** if missing or **`role !== ADMIN`**.
  - **`prisma.league.deleteMany({ where: { id: leagueId } })`** or **`delete`** with **404** when count/`RecordNotFound` is zero — avoid throwing **500** on double-delete.
  - Return **204 No Content** or minimal **`{ ok: true }`** JSON; document choice in handler comment.

- [x] **Schema verification** — Before implementing, **`prisma/schema.prisma`**: confirm **`League`** deletion cascades **all** league-scoped models **today** (**`Season`**, **`LeagueMembership`**, **`Invitation`** with **`leagueId`**). **When Epic 3+** adds **`Pick`** (and related), **each new FK to `League` or `Season` must use `onDelete: Cascade`** (or be deleted in the same transaction) — add a Dev Agent Record note if this story ships before those models.

- [x] **Client — settings UI** — Add a client component (e.g. **`delete-league-dialog.tsx`** next to **`first-competition-week-settings.tsx`**):
  - **MUI `Stack`**, **`Dialog`**, **`DialogTitle`**, **`DialogContent`**, **`DialogActions`**, **`TextField`**, **`Button`** (`color="error"` for primary destructive confirm).
  - Confirmation text field: enable submit only when **`value === "delete"`** (trim not allowed for the typed token — exact **`delete`**).
  - **`fetch(\`/api/leagues/${leagueId}\`, { method: "DELETE" })`** — same-origin from the browser supplies **`Origin`** / **`Sec-Fetch-Site`** per **`assertCookieSessionMutationOrigin`**.
  - On **2xx**: **`router.push("/leagues")`** (or **`router.replace`**) + optional **`router.refresh`** on the list page if needed.
  - Surface API **`error.message`** for failures; handle **401** (e.g. suggest sign-in) per existing app patterns.

- [x] **Settings page** — Update **`src/app/(app)/leagues/[leagueId]/settings/page.tsx`**: pass **`league.name`** and **`leagueId`** into the delete section; tighten or remove the placeholder copy that says destructive actions arrive in later stories.

- [x] **Rate limiting** — **`src/proxy.ts`** currently rate-limits specific **POST** paths only. Either **document** that **DELETE** is intentionally not rate-limited for MVP, or add a **`LEAGUE_DELETE`** path pattern if product wants parity — **document the decision** in the route handler comment.

- [x] **Regression** — **`npm run lint`**, **`npm test`**, **`npm run build`**.

## Dev Notes

### Epic context

- **Epic 2** closes with **FR61**: irreversible admin delete from the **settings** surface.
- **Story 2.7** shipped **first competition week** lock semantics — deleting a league **must not** require unlocking; deletion removes the **`Season`** row via cascade.

### Technical requirements

| Area | Requirement |
|------|-------------|
| **Authz** | **`LeagueMembershipRole.ADMIN`** only — same membership lookup as **`pre-season-init`** / **`first-competition-week`**. |
| **CSRF / origin** | **`assertCookieSessionMutationOrigin`** on **`DELETE`** (**`src/lib/cookie-session-mutation-csrf.ts`** — **`DELETE`** is in **`MUTATING`**). |
| **Errors** | JSON **`{ error: { code: string, message: string } }`**; align codes with existing routes (**`UNAUTHENTICATED`**, **`FORBIDDEN`**, **`LEAGUE_NOT_FOUND`**, **`INTERNAL_ERROR`**). |
| **Data** | **`prisma`** singleton **`@/lib/db`**; prefer single **`delete`** in a transaction only if non-cascade children appear later. |

### Current Prisma cascade map (as of Epic 2)

**`model League`** relations — all use **`onDelete: Cascade`** to **`League`**:

- **`Season.league`**
- **`LeagueMembership.league`**
- **`Invitation.league`** (nullable FK; league-scoped invites removed)

**`User`** is **not** deleted; **`LeagueMembership`** removal only drops membership for this league.

### Architecture compliance

- REST **`DELETE`** on **`/api/leagues/[leagueId]`** per **`architecture.md`** (league management / FR61).
- **NFR15:** origin assertion on mutating handler.
- **NFR28:** if future children lack DB cascade, wrap in **`$transaction`** with explicit deletes ordered by FK.

### Library & framework requirements

| Package | Version (repo) | Notes |
|---------|----------------|-------|
| `next` | `16.x` | Route Handler **`context.params`**: **`Promise`** — **`await`**. |
| `@mui/material` | `^7.x` | **`Stack`** for layout; dialog pattern for high-friction confirm. |
| `@prisma/client` | `6.x` | **`league.delete`** / **`deleteMany`**. |

### File structure requirements

```
src/app/api/leagues/[leagueId]/route.ts          # DELETE handler (new, if not present)
src/app/(app)/leagues/[leagueId]/settings/page.tsx
src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx   # or co-located name
```

### Testing requirements

- **Unit or integration:** Prefer a small test that **admin** membership allows delete and **MEMBER** receives **403** — follow patterns from other **`src/app/api`** tests if they exist; otherwise **`DELETE`** handler extracted pure guards tested via Vitest + mocked Prisma (minimal).

- **Manual QA:** Dialog confirm disabled until **`delete`** typed; success redirects; deleted league disappears from **`GET /api/leagues`** administered list and **`GET /api/leagues/joined`** for former members.

### Previous story intelligence (2.7)

**Artifact:** `_bmad-output/implementation-artifacts/2-7-first-nfl-competition-week-at-league-creation-mid-season-start.md`.

- Reuse **settings** page **ADMIN** gate and **MUI** patterns from **`FirstCompetitionWeekSettings`** (client island + **`fetch`** + **`router.refresh`** / **`router.push`**).
- **`pre-season-init`** and **`first-competition-week`** define the canonical mutation order: **parse body if any** → **`assertCookieSessionMutationOrigin`** → **`auth()`** → membership → Prisma. For **DELETE**, no body; still assert origin before **`auth()`**.

### UX reference

- **`_bmad-output/planning-artifacts/ux-design-specification.md`** — **Admin: delete league (production)**: red destructive button, modal, league name visible, type **`delete`** to enable confirm — **no checkbox-only** confirmation.

### Git intelligence

- Recent Epic **2** work touched **`settings/page.tsx`**, **`first-competition-week`** PATCH route, **`pre-season-init`** POST — mirror their error JSON and auth layout.

### Project context reference

- `docs/project-context.md` — server authority, **Stack**, structured API errors.
- `_bmad-output/planning-artifacts/epics.md` — Story **2.8**, **FR61**.

### Scope boundaries (avoid creep)

- **Do not** require test-league flags (**Epic 8**).
- **Do not** implement soft-delete / archive unless product adds a story — **FR61** is **permanent** delete.
- **Do not** delete **`User`** accounts or touch **Auth.js** tables beyond membership cascade.
- **Do not** add **`audit_log_entries`** persistence unless a table already exists — **optional log line** only for **2.8**.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Implemented **`DELETE /api/leagues/[leagueId]`** with **`assertCookieSessionMutationOrigin`** → **`auth()`** → league existence + **`authorizeLeagueDelete`** (404 for unknown/already-deleted id, 403 for non-admin, **`deleteMany`** + race guard), **204** on success, structured JSON errors elsewhere; optional **`console.info`** JSON line with **`league_deleted`**, **`leagueId`**, **`actorUserId`**, **`timestamp`**.
- Verified **`prisma/schema.prisma`**: **`Season`**, **`LeagueMembership`**, and **`Invitation.league`** all **`onDelete: Cascade`** from **`League`**. Epic 3+ models must keep cascade (or transactional deletes) when **`Pick`** and related tables land.
- Added **`DeleteLeagueDialog`** on settings: red destructive control, modal copy + server **`leagueName`**, confirm only when input is exactly **`delete`**, **`fetch` DELETE**, **`router.replace("/leagues")`** on success; API **`error.message`** on failure (401 uses existing **`Sign in required`** message).
- Documented **DELETE** not rate-limited in **`proxy.ts`** (POST-only sliding window) in the route file header comment.

### File List

- `src/app/api/leagues/[leagueId]/route.ts` (new)
- `src/app/(app)/leagues/[leagueId]/settings/delete-league-dialog.tsx` (new)
- `src/app/(app)/leagues/[leagueId]/settings/page.tsx` (modified)
- `src/lib/league/delete-league-authorization.ts` (new)
- `src/lib/league/delete-league-authorization.test.ts` (new)

## Change Log

- **2026-04-18** — Story authored from **`epics.md`**, **`sprint-status.yaml`**, **`ux-design-specification.md`**, **`prisma/schema.prisma`**, and Epic **2** API patterns. Status **ready-for-dev**.
- **2026-04-18** — Implemented FR61 admin delete (API, settings UI, unit tests for authorization helper). Status **review**.
- **2026-04-18** — Story marked **done** in sprint-status; header aligned (Epic 2 status sweep).
