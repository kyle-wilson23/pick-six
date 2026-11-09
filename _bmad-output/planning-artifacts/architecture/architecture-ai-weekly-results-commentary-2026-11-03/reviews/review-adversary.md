# Adversary review — AI weekly results commentary

- **Target:** `ARCHITECTURE-SPINE.md` (feature spine, checked claims, draft, updated 2026-11-08)
- **Scope:** That spine only. No spec, legend, or existing-app code was read.
- **Method:** For each adopted decision, try to name two units one level down (epics or stories of this feature) that obey every AD to the letter and still cannot be built together. Clash types that count: shared-data shape, two owners of one entity, conflicting mutation paths. A pair is a hole. Readings that break an AD's rule or its prevent clause were discarded. Style and naming nits were discarded.
- **Verdict:** **Fail.** Four pairs are real. One more pair is real but only bites when the same season is stored twice. The rest of the decisions bind.

---

## 1. Critical — Two owners of League person, and the weekly path must be one of them

**Pair**

- **Story CAP-4 "Accept the grid."** The local tool writes league persons and book rows only after Kyle accepts (AD-9). A person is created from a screenshot name. When Kyle maps that name to a member, the person points at that membership (AD-3). Members who are not on the grid get no person. Book-only people get no user and stay off invite lists (AD-3, AD-2). Matching is Kyle's accept, because a first-name join is forbidden (AD-3).
- **Story CAP-2 "Join this week."** The checker reads one history: book rows plus every live season for that league, joined on the league person (AD-2, AD-3). A missing screenshot file must not block the weekly feature (AD-9), so this story runs when the grid writer has never created a person. Live picks hang off membership (structural seed). To make the join true for those picks, this story creates a league person for any membership that no person points at, and points the new person at that membership. It does not invent a user (AD-3). It does not match screenshot rows by name (AD-3).

**Why both are legal.** AD-9 is the only rule that names a writer of league persons, and it also says the weekly feature runs without that writer. AD-2 and AD-3 require the live-season join anyway. Nothing says "create a person for a membership exactly once" or "the grid tool must adopt a person the weekly path already inserted."

**How they break.** The same member ends up as two league persons. The Tuesday run inserts person L pointing at membership M. A later accept inserts person S for the screenshot name and also points S at M. The seed's link is one-to-one (`LeaguePerson |o--o| LeagueMembership`), so the second pointer either fails the write or, if the story does not enforce uniqueness, splits the human. Book rows hang off S. Live picks join through L. The checker never sees one history for that member. It also cannot repair the split, because AD-3 forbids joining the two rows on a name.

The link column is part of the same hole. "A person with a login points at that membership" puts the pointer on the person. The ER line is symmetric and does not name a column. CAP-4 can persist `league_person.membership_id` while CAP-2 joins `league_membership.league_person_id`. Each side is a literal join. Neither side sees the other's rows.

**Consequence.** Imported seasons and live seasons diverge for the mapped member, which is the comparison the spine exists to make. Or the second write fails and the accept cannot store the book. Leagues with no screenshots still have no assigned creator for the persons the checker requires.

---

## 2. High — Two mutation paths for the one commentary run

**Pair**

- **Story "Delivering send."** Cron and the admin send are the triggers (structural seed, AD-4). If no row exists for the digest key, the send runs the model path to completion and inserts one commentary run: proved items, stop reason, quiet line only on a normal zero, spend. That is the first delivering send creating the record (AD-4). Later sends see the row and do not call the model (AD-4). A handled failure still inserts the abnormal stop and keeps proved items, and that week is not attempted again (AD-5). A suppressed test-league send inserts nothing (AD-4). The convention "written once and then only read" is satisfied.
- **Story "Runner claims the week."** The runner writes the run (flow diagram: `runner --> run`). On the first delivering send it inserts the row for the digest key before the model call, so a parallel cron and admin send observe the record and do not call (AD-4's prevent: preview, manual send, and cron must not each call the model). When the run finishes it writes the stop reason and the proved items onto that row (AD-5). A crash leaves the row, so the week is not attempted again (AD-5). Feature off and a suppressed test send still insert nothing (AD-4).

**Why both are legal.** No AD says whether the insert happens before the call or after it. No AD forbids a second write onto the same key. AD-4 names the send as what "creates" the record and the diagram names the runner as what writes it. The uniqueness rule ("one commentary run per league, NFL season year, and week") is the same key either way. The written-once sentence is a consistency convention, not an AD, so the claim-the-week story still obeys every AD. The finish-then-insert story obeys every AD and the convention, and it still loses the race the prevent clause describes.

**How they break.** Assigned to separate stories, both insert.

- Both call, then both insert: two spends. The unique key rejects the second insert. The loser has already spent. If the loser treats the constraint failure as an abnormal stop and the winner has not committed, the surviving row can be the failure. AD-5 then forbids another attempt.
- Runner inserts a pending row; the send treats "a row exists" as "read it and do not call," and mails scores with no proved items. The pending row is the attempt. AD-5 does not allow the finished result to replace it if the send story refuses updates. If the send story inserts a second finished row, the unique key throws and the pending row remains the attempt.

**Consequence.** A Tuesday where cron and the admin send both deliver mail can spend twice or freeze that league-week with no commentary. The ceiling limits the extra spend. The "not attempted again" rule makes a stub permanent.

---

## 3. High — The view and the checker do not share a person key

**Pair**

- **Story "Bounded view."** The app assembles one view of this week and the loaded history: people, outcomes, and points, with no credentials (AD-6). This week's people are the memberships that own the picks (seed: `LeagueMembership ||--o{ Pick`). History people are league persons that own book rows (seed: `LeaguePerson ||--o{ BookRow`). The view identifies a person by the id of the row it queried. The model proposes from that view (AD-6) and proposes no figures (AD-1).
- **Story "Re-prove."** The runner asks the Vercel AI SDK for a Zod claim list (AD-7). A claim carries a predicate and a person id, and no numbers (AD-1). An unknown predicate is dropped (deferred catalog; AD-1). The checker re-proves against the database by loading the league person, then book rows and live picks through that person (AD-2, AD-3, AD-6). A claim whose person id is not a league person is dropped.

**Why both are legal.** AD-6 lists the view's contents as "people, outcomes, and points" and never says which id a person carries. AD-7 requires a Zod claim list and never says the claim's referent. AD-1 requires a predicate and forbids figures; an id is not a figure. AD-3 requires the database join to use the league person and forbids a first-name join, so the checker story's key is the one the ADs name. The view story's key is the one the seed's relationships name. Colocating both in `src/lib/commentary/` does not pick an id.

**How they break.** The model can only cite ids that appear in the view. It cites a membership id for a current picker. The checker looks up a league person and drops the claim. Every claim about this week's members fails closed. A normal zero then stores the quiet line (AD-5) for a week that had provable results. Book-only ids round-trip only for people who have no live picks, which is the comparison that does not need both sides.

**Consequence.** The two CAP-2 stories integrate, spend, and persist a quiet week. Raising a single league-person owner (finding 1) does not close this. The view can still emit the membership id after a person row exists.

---

## 4. Medium — A historical week has no identity across the two stores

**Pair**

- **Story CAP-4 "Write rows."** Each accept inserts book rows: person, year, week, outcome, points, team when present (consistency table, AD-9). A second accept of the same file inserts again. Points follow the legend (1, 2, or 0). The story does not update prior rows, because no AD says an accept replaces a year.
- **Story CAP-2 "Read one history."** The checker unions those rows with every live season for the league, joined on the league person (AD-2). It keeps both copies when a person-year-week appears in the book and in picks. Nothing in the ADs says the two sets are disjoint or that the union is distinct on (person, year, week).

**Why both are legal.** AD-2's rule is "book rows plus every live season," which is a union, and its prevent clause forbids ignoring a finished live season. It does not forbid counting the same week twice. AD-9 tells the tool to write rows after accept and does not say the write is an upsert. The deferred renew note says completed live seasons already persist, so a screenshot year can be a year the app also stored as picks.

**How they break.** A sum, a streak, or a "best week" claim sees two outcomes for one week. Re-proof confirms the doubled total, because both copies are in the database the checker is required to read. A second accept doubles the book side even when no live season overlaps.

**Consequence.** Confirmed sentences overstate the record. The quiet-line and named-years rules still hold; they name the years and print the wrong number. This is dormant until a year is accepted twice or a screenshot year overlaps a live season. The spine does not forbid either.

---

## 5. Medium — Partial success has two legal displays, and only one surface can show it

**Pair**

- **Story "Digest section."** Scores send either way (AD-5). Proved items stay on the record when a later call fails (AD-5). The quiet line is stored only for a normal zero (AD-5). The omit sentence is read as the conjunction it states: zero confirms and an abnormal stop leave the section out. Any other stored proved lines are the record the digest shows when debug is off (AD-10).
- **Story "Admin debug."** While debug is on, the digest omits the section and this screen shows the stored outcome (AD-10). The outcome is defined as proved lines, or the quiet line, or a failure. This story treats an abnormal stop as the failure case, so a failure is what it shows, and it does not show the failure as the quiet line (AD-10). Proved lines stored beside that stop are not shown.

**Why both are legal.** AD-5 requires the mixed state to be stored: items kept, stop reason stored, quiet line absent. It requires the section to be omitted for the zero-and-abnormal case, and it does not say to omit the section when items exist. AD-10 names three displays joined by "or" and does not give precedence when items and a failure are both stored. Debug off shows "the record" (AD-10), which both stories can claim to do.

**How they break.** The mixed record is one shape with two readers. The digest mails the proved lines. The admin screen, which is the only reader while debug is on, shows the failure and hides those lines. Kyle turns debug on to review the week (AD-10) and cannot see the items the runner kept. The other precedence (lines win, failure hidden) is equally legal under the "or" and hides the abnormal stop that AD-5 will not retry.

**Consequence.** Debug review and the member digest disagree about the same row. One of the two facts AD-5 stored (kept items, or the stop that closed the week) is invisible on the surface that is supposed to show the stored outcome. No second model call results; the damage is a false review of a week that will not run again.

---

## Readings that do not yield a pair

- **Renew versus "every live season" (AD-2).** A checker that waits for renew before it reads live picks violates the prevent clause (a finished live season must not be a second history) and the rule that the checker reads every live season. Renew is out of scope. That reading is not a legal unit.
- **Debug skips the spend (AD-4, AD-10).** Debug on omits the section from the digest and still requires a stored outcome on the admin screen. The only send AD-4 exempts from creation is a suppressed test-league send. A story that spends nothing while debug is on leaves the admin screen with nothing to show and breaks AD-10.
- **Feature off deletes a row (AD-4).** "No record, no section, and no spend" governs the send that finds the flag off. It does not authorize a second writer to delete a row already stored. No clashing pair.
- **Dollar ceiling versus the stop at three items (AD-1, AD-7, AD-8).** "The ceiling" in AD-1 is the per-league dollar ceiling. Three confirmed items is the other stop. Spend is post-usage and checked before another call. One protocol satisfies all three decisions.
- **Switches (AD-8) and prices (AD-7).** Three per-league columns, admin writes the on/off flag, Kyle writes debug and the ceiling, prices stay server env. A second table for the same three flags would be an extra invention, not a second legal home the spine already describes.
- **Quiet line text (AD-5, consistency).** The member-facing string is fixed. Failure must not be rendered as that string (AD-10). No second string is legal.
- **Claim catalog and sentence wording.** Both are deferred. An unknown predicate is dropped (AD-1). That drop rule is shared. The hole in finding 3 is the person referent, which the deferral does not mention.
- **Book outcome vocabulary.** Points for the five fills are fixed (AD-9): 1, 2, or 0. A checker that sums those points agrees with a backfill that stores the legend class in `outcome`. An invented `outcome === "win"` token is not required by any AD. No pair was counted.
