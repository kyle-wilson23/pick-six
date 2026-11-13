# Epic 10 Context: Tuesday results commentary

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A league admin can turn on a checked Tuesday note: up to three confirmed observations, or exactly "Quiet week. Nothing new for the record book." Kyle can cap that week's spend and hold the note for review. The scores email still goes out, and an empty book is a valid history. No UX design spec exists; layout inside the existing admin email screen is deferred.

## Stories

- Story 10.1: Turn weekly commentary on or off
- Story 10.2: Show the checked note in the Tuesday digest
- Story 10.3: Set the league's weekly dollar ceiling
- Story 10.4: Hold the note on the league admin email screen
- Story 10.5: Count the loaded book as one history

## Requirements & Constraints

- Commentary defaults off, including for leagues that already exist. Only the league admin path changes that switch. Off means no digest section, no stored run, and no spend.
- Create a run only when commentary is on and the send will deliver mail. A suppressed test-league send stores nothing and spends nothing.
- One record per league, NFL season year, and week — the digest's existing key. Insert it before the model call and update that same record. A later attempt, including a retry or an unfinished record, does not call the model. Unfinished means an abnormal stop.
- The model proposes 0 to 3 lines and the app does not pad. It chooses the facts; there is no record-type catalog, and the app does not rank facts or rewrite a matching sentence. Each line is that sentence plus cells: league person, year, week, outcome, points, and the team when there is one.
- Re-read every cited cell. Drop a mismatch, any "league history" or "all-time," and any year comparison that does not name its years. Checking does not spend. A normal finish with nothing confirmed stores exactly "Quiet week. Nothing new for the record book." Only the app writes that sentence, and only in that case.
- Stop at 3 confirmed items or the ceiling, whichever comes first, and do not start another model call after the ceiling. The default ceiling is $1 per enabled league per week, in decimal dollars. Kyle, the configured superuser, can replace it per league. A league admin cannot.
- Only a model call spends: token usage times the configured input and output price per million tokens, same unit as the ceiling. A missing price does not call; that week is an abnormal stop.
- The scores email sends anyway. Store the stop reason and any proved lines, and keep proved lines if a later call fails. Zero proved lines plus an abnormal stop omit the section, skip the quiet line, and are not retried.
- Members cannot prompt or chat. No page calls the model or shows the commentary to members. No page shows past-season win/loss or biggest-loser points as records. Member pages read only the current season.
- The model may use only this week and the loaded book. The app is the only querier. The view has people, outcomes, and points, and no passwords, sessions, or credentials.
- Before a run, link each current membership to a league person, creating one if needed. At most one person points at a membership. Invite lists stay on memberships. A book-only person has no user and no login.
- Debug defaults off; only Kyle can change it. While on, the one run still happens and still spends, the digest omits the section, and the existing league admin email screen shows the stored lines. A failure is not the quiet line. While off, that screen hides the note, and the digest shows it only for proved lines or the quiet line. Anyone who can open that league's admin screen can read a debug week. The screen does not call the model.
- An empty book is valid. Book rows are not Pick rows: unique on person, year, and week, storing person, year, week, outcome, points, and team when there is one. One history on the league person. A live season for a year wins; ignore book rows for that year. A missing year does not block the weekly note. Name the years the checker actually read.

## Technical Decisions

- Keep host, database, Tuesday digest, auth, cron, and admin send as they ship. Add the run, the book, and the checker on the existing Vercel app and its production and preview environments.
- `src/lib/commentary/` holds the line schema, view, checker, and runner. `src/lib/email/` only reads the stored run. `src/components/admin/` renders a debug week on the existing email screen. Prisma holds league person, book row, commentary run, and the per-league switches.
- A league has many league persons and many commentary runs. A league person links to at most one membership and has many book rows. Live weeks stay on the season and its picks.
- Call the Vercel AI SDK only, for a Zod list of lines. Do not hardcode a provider SDK or a price for one model id. Each environment has its own server env for the API key, model id, and token prices. This epic does not choose those values.
- One history query, keyed by league person, builds the view; re-read cited cells on that same key. No per-line fetch and no database login for the model.
- Screenshot import and renewal are out of scope. The reader stays on Kyle's machine and its spend is outside the weekly ceiling.

## UX & Interaction Patterns

Members see the note only in the Tuesday digest, and only when debug is off and the outcome is proved lines or the quiet line. The admin email screen is the review surface while debug is on, and it never starts a run. Layout inside that screen is deferred.

## Cross-Story Dependencies

- 10.1 gates 10.2. Off skips the run, the section, and the spend.
- 10.2 stops at three confirms or the ceiling. Until 10.3 sets one, the ceiling is $1. 10.3 and 10.4 share the existing superuser path.
- 10.4 only changes where the stored outcome is shown. An abnormal stop stays distinct from the quiet line.
- 10.5 is the history 10.2 reads. An empty book must still let a run finish. Epic 11 later writes book rows and book-only people; a missing year must not block this epic.
