---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-ai-weekly-results-commentary/SPEC.md
  - _bmad-output/specs/spec-ai-weekly-results-commentary/historical-cell-legend.md
  - _bmad-output/planning-artifacts/architecture/architecture-ai-weekly-results-commentary-2026-11-03/ARCHITECTURE-SPINE.md
workflow: create-epics-and-stories
project_name: pick-six
feature: AI weekly results commentary
---

# pick-six - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for pick-six, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

This inventory is the feature contract for AI weekly results commentary only. It does not replace `_bmad-output/planning-artifacts/epics.md`, the product breakdown completed on 2026-04-04. The product PRD, product architecture, and product UX specification were excluded from this run. There is no UX design contract in the input set.

## Requirements Inventory

### Functional Requirements

FR1: A league admin can turn weekly results commentary on or off for that league. Every league starts off, including leagues that already exist.

FR2: While commentary is off, the Tuesday digest includes no commentary, the league stores no commentary run, and the league adds nothing to that week's model spend.

FR3: While commentary is on and the send will deliver mail, that league gets one commentary run for the week being sent, and that run spends.

FR4: A suppressed test-league send does not store a commentary run and does not spend.

FR5: When debug is off, the Tuesday digest shows the stored commentary only when the outcome is proved lines or the quiet line. When debug is on, the digest omits the commentary section.

FR6: A run shows 0 to 3 lines and does not pad. The model writes each line, choosing the most impactful facts or broken records it found. Each line carries the cells it depends on: league person, year, week, outcome, points, and the team when there is one. The app re-reads those cells. A line whose cells do not match is absent. A line that matches is stored as the model wrote it. The quiet line is the app's. There is no catalog of record types.

FR7: When a run finishes normally with nothing confirmed, the stored text is exactly "Quiet week. Nothing new for the record book." The model does not write that line.

FR8: The model may propose only from this week or the loaded book, and it writes the lines. Members cannot prompt it or chat with it.

FR9: No member page shows the commentary. No page shows past-season win/loss records or past-season biggest-loser points as records. Member pages read only the current season.

FR10: Kyle can set a weekly dollar ceiling on a league. The default is $1 per enabled league per week. A ceiling he sets on that league replaces the default. A league admin cannot change the amount.

FR11: The run stops at 3 confirmed items or at the ceiling in force, whichever comes first. It does not start another model call once the ceiling is reached. The ceiling may end the run before the best claim is proposed.

FR12: Before go-live, this production league can load past seasons from screenshots. The tool prints what it read. Nothing is written until Kyle accepts that reading, and only once every first name is mapped to a current member or a past member who still counts.

FR13: Each screenshot is one season of first names across weeks. The filename is the season year. A file for the league's current season is rejected. A plain CSV is rejected.

FR14: Historical outcome is the cell fill. Green is a win at 1 point. Pale blue is a win against the jailed team at 2 points. Red with a team is a loss at 0. Empty red is a real loss at 0, including for Biggest Loser, in the same class as a submitted loss. Yellow or orange is an invalid pick, counted as a loss at 0.

FR15: A season with no screenshot is omitted and does not block go-live or the weekly feature. A printed comparison names the years it used and does not say "league history" or "all-time." Existence means the history the checker read.

FR16: A later renewal of this production league keeps the imported years, including people who do not return. Building renewal is out of scope. A new league has no historical import. Its book starts with its first season in the app.

FR17: Kyle can turn debug on for a league. Debug stays off until he does. A league admin cannot change it. While debug is on, that week's one run still happens and still spends, the Tuesday digest has no commentary section, and the league admin email screen shows the stored lines. That screen does not call the model. A failure is not shown as the quiet line.

FR18: While debug is off, the league admin email screen does not show the commentary. Anyone who can open that league's admin screen can read a debug week.

FR19: There is one commentary record per league, NFL season year, and week, the same key the Tuesday digest already uses. The runner inserts that record before the model call and then updates it in place. A later attempt sees the record and does not call the model. An unfinished record is an abnormal stop, not a second call. No page calls the model.

FR20: The scores email sends whether or not commentary succeeds. The record stores the stop reason and any proved lines. Proved items are kept when a later call fails.

FR21: The quiet line is stored only when the run finishes normally with zero confirms. Zero proved lines and an abnormal stop leave the digest section out. That week is not attempted again.

FR22: Imported years are book rows, not Pick rows. The checker reads one history joined on the league person. When the league has a live season for a year, the checker uses that season's picks and ignores book rows for that year. Other years come from book rows. A book row is unique on person, year, and week, and stores the person, year, week, outcome, points, and team when there is one.

FR23: The app owns the league person. At most one person points at a membership. Before a run, each current membership is linked to its person, and that person is created when the membership has none. The import uses that person for a mapped current member and creates a person only for a past member who still counts and has no membership. A book-only person has no user and no login. Invite lists use memberships.

### NonFunctional Requirements

NFR1: The model cannot read passwords, sessions, or credentials. The app is the only querier. The view passed to the model contains people, outcomes, and points for this week and the loaded history, and nothing secret.

NFR2: Proving or dropping a claim does not spend. Only a model call spends. Spend is token usage times the configured input and output price per million tokens, in decimal dollars, the same unit as the league ceiling.

NFR3: A missing model price does not call the model. That week follows the abnormal-stop rule in FR21.

NFR4: Model spend for the screenshot reading on Kyle's machine is outside the weekly league ceiling.

### Additional Requirements

- No starter template. The host, database, Tuesday digest, and auth stay as the app already ships them. This feature adds the commentary run, the loaded book, and the checker.
- The weekly path deploys with the existing Vercel app, in the production and preview environments that app already has. Cron and the admin send stay the triggers.
- Each environment holds its own server env for the model API key, the model id, and the input and output price per million tokens. The spine does not choose the model id, those prices, or the vision model id on the local tool.
- The runner calls the Vercel AI SDK only and asks for a Zod list of lines. Each line is a sentence plus its cells. Do not hardcode a provider SDK beside it, and do not hardcode a price for one model id.
- Code homes: `src/lib/commentary/` for the line schema, view, checker, and runner; `src/lib/email/` so the digest reads the stored run and does not call the model; `src/components/admin/` so a debug week renders the stored outcome on the existing league admin email screen; `prisma/` for the league person, book row, commentary run, and per-league switches.
- Data model: a league has many league persons and many commentary runs. A league person links to at most one membership. A league person has many book rows. Live weeks stay on the season and its picks. Book rows are not pick rows.
- Conventions: columns stay snake_case and primary keys stay cuid. The runner inserts the run and then updates that same record. After the run settles, the digest and the admin screen only read it.
- The app builds one bounded view from one history query keyed by league person. It re-reads every cited cell against the database on that same key. There is no fetch per line and no database login for the model.
- The backfill reader stays on Kyle's machine. It need not be committed or deployed, and it need not call the runner's client. It vision-reads images only, prints a grid of first name, week, fill, and team, and writes rows only after Kyle accepts.
- There is no catalog of record types. The model writes the line. The app drops a line whose cited cells do not match, and drops a line that says "league history" or "all-time" or compares years without naming them. The app does not rewrite a matching line. The quiet line stays the app's. The renew flow is deferred. Layout inside the existing admin email screen is deferred.
- Stack already in the app: Next.js 16.2.2, React 19.2.4, Prisma 7.8.0, Zod 4.3.6, Vercel AI SDK (`ai`) 7.0.165, MUI 7.3.11, `@prisma/adapter-pg` 7.7.0, the existing Neon Postgres project, and the existing Vercel project.

### UX Design Requirements

No UX design contract was included. The product UX specification was left out of this run. The architecture spine defers layout inside the existing admin email screen. There are no UX design requirements to implement from a design spec.

### FR Coverage Map

FR1: Epic 10 — Admin on/off, default off
FR2: Epic 10 — Off means no section, no run, no spend
FR3: Epic 10 — A delivering send runs once and spends
FR4: Epic 10 — A suppressed test send does not run or spend
FR5: Epic 10 — The digest shows the outcome only when debug is off and the outcome is printable
FR6: Epic 10 — 0 to 3 lines, written by the model and kept only when the cited cells match
FR7: Epic 10 — The exact quiet line on a normal empty week
FR8: Epic 10 — The model sees only this week or the loaded book
FR9: Epic 10 — Commentary and past-season records stay off member pages
FR10: Epic 10 — Kyle's per-league ceiling, default $1
FR11: Epic 10 — Stop at 3 confirms or the ceiling
FR12: Epic 11 — Screenshot import, printed, accepted only after names are mapped
FR13: Epic 11 — One season per file; reject the current season and a plain CSV
FR14: Epic 11 — Cell-fill legend
FR15: Epic 10 and Epic 11 — Named years in the sentence; a missing year does not block
FR16: Epic 11 — Imported years survive a later renewal; new leagues have no import
FR17: Epic 10 — Debug still runs and spends; the admin email screen shows the stored lines
FR18: Epic 10 — Debug off hides that screen's copy
FR19: Epic 10 — One stored run, no second model call
FR20: Epic 10 — The scores email sends anyway
FR21: Epic 10 — Abnormal stop is omitted and not retried
FR22: Epic 10 and Epic 11 — One history; live season wins; book rows for other years
FR23: Epic 10 and Epic 11 — League person for current members and for past members who still count

## Epic List

### Epic 10: Tuesday results commentary
A league admin can turn the note on. Members then see up to three confirmed observations in the Tuesday digest, or exactly "Quiet week. Nothing new for the record book." Kyle can set that league's dollar ceiling and can hold the note on the league admin email screen. The scores email still goes out. An empty book is a valid history.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR15, FR17, FR18, FR19, FR20, FR21, FR22, FR23
**NFRs covered:** NFR1, NFR2, NFR3

### Epic 11: Past seasons in the book
Kyle can load this production league's earlier seasons from screenshots, check the printed reading, and accept it into the book, including people who do not return. A missing year does not block the weekly note. A new league has no import. Renewal itself is not built.
**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR22, FR23
**NFRs covered:** NFR4

## Epic 10: Tuesday results commentary

A league admin can turn the note on. Members then see up to three confirmed observations in the Tuesday digest, or exactly "Quiet week. Nothing new for the record book." Kyle can set that league's dollar ceiling and can hold the note on the league admin email screen. The scores email still goes out. An empty book is a valid history.

### Story 10.1: Turn weekly commentary on or off

As a league admin,
I want to turn weekly results commentary on or off for my league,
So that an off league never adds a commentary section or a model charge to the Tuesday digest.

**FRs covered:** FR1, FR2

**Acceptance Criteria:**

**Given** a league that already exists, or a league that was just created
**When** no admin has turned commentary on
**Then** that league's commentary switch is off

**Given** commentary is off
**When** the Tuesday digest send runs for that league, whether or not the send will deliver mail
**Then** the email has no commentary section
**And** no commentary run is stored
**And** the send adds nothing to that week's model spend

**Given** a league admin turns commentary on or off
**When** the switch is saved
**Then** only the admin path can change it
**And** the saved choice remains until an admin changes it again
**And** this story does not call the model

### Story 10.2: Show the checked note in the Tuesday digest

As a league member,
I want the Tuesday digest to include this week's confirmed commentary when my league has it on,
So that I can read what was rare, and a line whose cited cells do not match the book is left out.

**FRs covered:** FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR11, FR15, FR19, FR20, FR21, FR23
**NFRs covered:** NFR1, NFR2, NFR3

**Acceptance Criteria:**

**Given** commentary is on and the Tuesday send will deliver mail
**When** the digest is sent for that league-week
**Then** the runner inserts one commentary record for that league, season year, and week before the model call
**And** it updates that same record in place
**And** the model is called once through the Vercel AI SDK and asked for a Zod list of lines
**And** spend is token usage times the configured input and output price per million tokens, in decimal dollars

**Given** that record already exists for the league-week, including after a retry, a second send, or an unfinished record
**When** the Tuesday send runs again
**Then** the model is not called
**And** an unfinished record is an abnormal stop, not a second call

**Given** the league is a test league and the send is suppressed
**When** the Tuesday send runs, even if commentary is on
**Then** no commentary record is stored
**And** nothing is spent

**Given** the model proposes up to 3 lines from this week or the loaded book
**When** the checker reads a line
**Then** the line is the model's sentence plus the cells it depends on
**And** a cell is the league person, year, week, outcome, points, and the team when there is one
**And** the checker does not spend

**Given** a cited cell does not match the database, the sentence says "league history" or "all-time," or the sentence compares years without naming them
**When** the run finishes
**Then** that line is absent
**And** the app does not rewrite it
**And** the run does not pad

**Given** every cited cell matches
**When** the line is stored
**Then** the stored text is the model's sentence, unchanged
**And** the app did not decide that the line was a record or the most impactful fact

**Given** the run finishes normally with nothing confirmed
**When** the record is stored
**Then** the text is exactly "Quiet week. Nothing new for the record book."
**And** the model did not write that line

**Given** one or more lines are confirmed
**When** the run reaches 3 confirmed lines or the league's $1 ceiling, whichever comes first
**Then** the runner does not start another model call
**And** the ceiling may stop the run before a later line is proposed
**And** the stored outcome has at most 3 lines

**Given** the model price is missing
**When** a delivering Tuesday send would otherwise start the model call
**Then** the model is not called
**And** the record stores that stop reason
**And** the quiet line is not stored
**And** the digest has no commentary section
**And** the scores email still sends
**And** that week is not attempted again

**Given** a later model call fails, or the run stops for any other abnormal reason
**When** that week is settled
**Then** the scores email still sends
**And** the record stores the stop reason and any proved lines
**And** proved items already stored are kept
**And** the quiet line is not stored
**And** the digest has no commentary section
**And** that week is not attempted again

**Given** the run finished normally with proved lines or the quiet line
**When** the Tuesday digest is rendered
**Then** the digest reads that stored outcome and does not call the model
**And** no member page shows the commentary
**And** no page calls the model

**Given** the runner builds the view for the model
**When** the view is passed
**Then** the app is the only querier
**And** the view has this week's people, outcomes, and points, and no passwords, sessions, or credentials
**And** the app re-reads every cited cell against the database
**And** members cannot prompt the model or chat with it

**Given** a current membership has no league person
**When** a run is about to start
**Then** the app creates that person and links the membership
**And** at most one person points at a membership
**And** invite lists still use memberships

**Given** a stored sentence compares years
**When** it is rendered
**Then** it names the years it used
**And** it does not say "league history" or "all-time"
**And** a sentence that fails either rule was dropped and was not rewritten

### Story 10.3: Set the league's weekly dollar ceiling

As Kyle,
I want to set a weekly dollar ceiling for one league,
So that the run stops at my amount instead of the $1 default, and a league admin cannot change it.

**FRs covered:** FR10, FR11

**Acceptance Criteria:**

**Given** a league whose ceiling has not been changed
**When** a commentary run starts
**Then** the ceiling in force is $1

**Given** Kyle sets a ceiling on one league
**When** that ceiling is saved
**Then** it replaces the $1 default for that league only
**And** another league keeps its own ceiling
**And** the amount is decimal dollars, the same unit the runner uses for spend
**And** Kyle's path is the configured superuser, not a new role

**Given** a league admin tries to change the ceiling
**When** the admin path handles the request
**Then** the ceiling is unchanged
**And** the admin path can still change only the on/off switch

**Given** Kyle has replaced the default and commentary is on
**When** a delivering Tuesday send runs
**Then** the run stops at 3 confirmed items or at the ceiling in force, whichever comes first
**And** the runner does not start another model call once that ceiling is reached

### Story 10.4: Hold the note on the league admin email screen

As Kyle,
I want to hold an enabled league's commentary out of the Tuesday digest and read the stored lines on the league admin email screen,
So that I can check the note before members see it.

**FRs covered:** FR5, FR17, FR18

**Acceptance Criteria:**

**Given** a league whose debug switch has not been changed
**When** the league is read
**Then** debug is off

**Given** Kyle turns debug on or off for one league
**When** the switch is saved
**Then** only Kyle's path can change it
**And** a league admin cannot change it
**And** Kyle's path is the configured superuser

**Given** debug is on and commentary is on
**When** a delivering Tuesday send runs
**Then** that week's one run still happens and still spends
**And** the Tuesday digest has no commentary section
**And** the existing league admin email screen shows the stored outcome
**And** that screen does not call the model
**And** an abnormal stop is not shown as the quiet line

**Given** debug is off
**When** someone opens that league's admin email screen
**Then** the screen does not show the commentary
**And** the digest includes the commentary section only when the stored outcome is proved lines or the quiet line

**Given** debug is on
**When** anyone who can open that league's admin screen views the email section
**Then** they can read that debug week's stored lines

### Story 10.5: Count the loaded book as one history

As a league member,
I want a comparison to use this week and the loaded book as one history,
So that a year already in the book can be cited, and a live season is never counted twice.

**FRs covered:** FR8, FR9, FR15, FR22

**Acceptance Criteria:**

**Given** the book has no rows
**When** a commentary run reads history
**Then** the run still completes from this week
**And** the digest still shows the stored outcome

**Given** book rows exist for a year that has no live season
**When** the checker reads history
**Then** those rows are included
**And** they are book rows, not Pick rows
**And** a book row is unique on person, year, and week
**And** a row stores the person, year, week, outcome, points, and the team when there is one

**Given** the league has a live season for a year
**When** the checker reads that year
**Then** it uses that season's picks
**And** it ignores book rows for that year

**Given** the model proposes a line
**When** the view is built
**Then** the view includes this week and that one history, keyed by league person
**And** it has no passwords, sessions, or credentials
**And** the model cannot hunt past this week or the loaded book

**Given** the model writes a sentence that compares years
**When** the checker stores it
**Then** the sentence names the years the checker read
**And** it does not say "league history" or "all-time"
**And** a sentence that fails either rule is dropped and is not rewritten

**Given** book rows exist
**When** any page is rendered
**Then** no page shows past-season win/loss records or past-season biggest-loser points as records
**And** member pages read only the current season
**And** no member page shows the commentary

## Epic 11: Past seasons in the book

Kyle can load this production league's earlier seasons from screenshots, check the printed reading, and accept it into the book, including people who do not return. A missing year does not block the weekly note. A new league has no import. Renewal itself is not built.

### Story 11.1: Print one screenshot season

As Kyle,
I want the local tool to print what it read from one season screenshot,
So that I can check the reading before anything is written into the book.

**FRs covered:** FR12, FR13
**NFRs covered:** NFR4

**Acceptance Criteria:**

**Given** a screenshot whose filename is a past season year
**When** the tool reads it
**Then** it prints a grid of first name, week, fill, and team
**And** a cell that names a team is that person's pick
**And** nothing is written to the database
**And** the vision call sees the image only
**And** that spend is outside the weekly league ceiling

**Given** a plain CSV, or a file whose year is the league's current season
**When** the tool is given that file
**Then** the file is rejected
**And** nothing is written

**Given** the tool is used
**When** it runs
**Then** it runs on Kyle's machine
**And** it is not part of the deployed app
**And** it need not be committed
**And** it does not call the commentary runner

### Story 11.2: Accept a mapped season into the book

As Kyle,
I want to accept a checked screenshot season into the book,
So that this production league's past weeks count as history, including people who do not return.

**FRs covered:** FR12, FR14, FR16, FR22, FR23

**Acceptance Criteria:**

**Given** the printed grid still has a first name that is not mapped
**When** Kyle tries to accept it
**Then** nothing is written

**Given** every first name is mapped to a current member's league person, or to a past member who still counts
**When** Kyle accepts the reading
**Then** the tool writes book rows for that year
**And** it uses the existing league person for a mapped current member
**And** it creates a league person only for a past member who still counts and has no membership
**And** that book-only person has no user and no login
**And** invite lists still use memberships

**Given** a cell is written
**When** the fill is recorded
**Then** green is a win at 1 point
**And** pale blue is a win against the jailed team at 2 points
**And** red with a team is a loss at 0
**And** empty red is a real loss at 0, including for Biggest Loser, in the same class as a submitted loss
**And** yellow or orange is an invalid pick counted as a loss at 0

**Given** the rows are stored
**When** they are read back
**Then** they are book rows, not Pick rows
**And** each row is unique on person, year, and week
**And** a row stores the person, year, week, outcome, points, and the team when there is one
**And** the rows and the book-only people remain in place for a later renewal
**And** this story does not build renewal

### Story 11.3: Leave a missing year out

As Kyle,
I want a season with no screenshot to be skipped,
So that a missing year does not block go-live, and a new league never gets this import.

**FRs covered:** FR15, FR16

**Acceptance Criteria:**

**Given** one season file is missing and Kyle has accepted the other seasons
**When** the import runs
**Then** the missing year is omitted
**And** the accepted years are still written
**And** the weekly commentary feature still runs
**And** a comparison names only the years in the history
**And** it does not say "league history" or "all-time"

**Given** a league other than this production backfill
**When** someone looks for a historical import
**Then** that league has no import
**And** its book starts with its first season in the app
