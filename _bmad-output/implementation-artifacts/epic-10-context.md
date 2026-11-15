# Epic 10 Context: Tuesday results commentary

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A league admin can turn a weekly results note on. Members then see up to three confirmed observations in the Tuesday digest, or exactly "Quiet week. Nothing new for the record book." Kyle can set that league's dollar ceiling and can hold the note on the league admin email screen. The scores email still goes out. An empty book is a valid history.

## Stories

- Story 10.1: Turn weekly commentary on or off
- Story 10.2: Show the checked note in the Tuesday digest
- Story 10.3: Set the league's weekly dollar ceiling
- Story 10.4: Hold the note on the league admin email screen
- Story 10.5: Count the loaded book as one history

## Requirements & Constraints

Every league starts off, including leagues that already exist. Off means no digest section, no stored run, and no model spend.

A delivering send — commentary on, and mail will go out — gets one run for that league-week, and that run spends. A suppressed test-league send stores nothing and spends nothing. The scores email sends either way.

The model proposes only from this week or the loaded book and writes the lines. Members cannot prompt or chat with it. Commentary stays off member pages. No page shows past-season win/loss records or past-season biggest-loser points as records. Member pages read only the current season.

A run has 0 to 3 lines and does not pad. There is no catalog of record types. Each line cites league person, year, week, outcome, points, and the team when there is one. The app re-reads those cells. A mismatch is dropped. A match is stored unchanged. The app does not rewrite a line or decide that it is a record. Drop a sentence that says "league history" or "all-time," or that compares years without naming them. A kept comparison names the years actually read. A missing year does not block the weekly feature.

The quiet line is exactly "Quiet week. Nothing new for the record book." The app writes it only when the run finishes normally with zero confirms. An abnormal stop, including a missing model price, stores the stop reason, keeps proved lines, omits the section, and is not retried.

The default ceiling is $1 per enabled league per week, in decimal dollars. Kyle can replace it for one league. A league admin cannot. Stop at 3 confirms or the ceiling in force, whichever comes first, and do not start another model call once the ceiling is reached. The ceiling may end the run before the best claim is proposed.

Debug defaults off, and only Kyle can change it. While it is on, the run still happens and still spends, the digest omits the section, and the league admin email screen shows the stored lines without calling the model. A failure is not shown as the quiet line. While it is off, that screen hides the note, and the digest shows it only for proved lines or the quiet line. Anyone who can open that league's admin screen can read a debug week.

One record per league, NFL season year, and week — the same key the Tuesday digest already uses. Insert it before the model call. A later attempt, including an unfinished record, does not call again. No page calls the model.

The model never sees passwords, sessions, or credentials. Only the app queries. The view is people, outcomes, and points for this week and the loaded history. Only a model call spends. Spend is token usage times the configured input and output price per million tokens, in the same decimal dollars as the ceiling.

Before a run, link each current membership to one league person, creating the person when needed. At most one person points at a membership. A book-only person has no user and no login. Invite lists use memberships.

## Technical Decisions

Leave the host, database, Tuesday digest, and auth as they ship. Add the run, the book, and the checker on the existing Vercel app, production and preview. Cron and the admin send stay the triggers.

Call the Vercel AI SDK only, asking for a Zod list of lines (sentence plus cells). Do not add a provider SDK or hardcode a price for one model id. The model API key, model id, and token prices are per-environment server env. The id and the prices are not chosen here. A missing price does not call.

`src/lib/commentary/` holds the line schema, view, checker, and runner. `src/lib/email/` reads the stored run and does not call the model. `src/components/admin/` renders a debug week on the existing league admin email screen. `prisma/` holds the league person, book row, commentary run, and per-league switches.

A league has many league persons and many commentary runs. A league person links to at most one membership and has many book rows. Live weeks stay on the season and its picks. Book rows are not pick rows, are unique on person, year, and week, and store person, year, week, outcome, points, and team when there is one. One history, joined on the league person: a live season for a year wins, and book rows for that year are ignored.

Build the view from one history query on that person key, then re-read every cited cell against the database. No fetch per line, and no database login for the model. Insert the run, then update that same record.

Kyle's ceiling and debug path is the configured superuser, not a new role. The admin path writes only the on/off flag. The screenshot reader stays on Kyle's machine, need not be committed, and need not call the runner. Renewal and layout inside the admin email screen are deferred.

## UX & Interaction Patterns

There is no visual design contract. The member surface is the Tuesday digest section. Debug review reuses the existing league admin email screen and only reads the stored outcome. How that block is laid out is deferred.

## Cross-Story Dependencies

On/off gates the run. The ceiling and the three-line cap stop it. Debug only changes where the outcome is shown.

This week and the loaded book are one history. An empty book still lets the run finish. A live season replaces book rows for that year.

Screenshot import, the cell-fill legend, and keeping imported years across renewal belong to the past-seasons epic. This epic reads book rows when they exist and still runs when a year was never loaded. A new league has no import. Its book starts with its first season in the app.
