# Epic 11 Context: Past seasons in the book

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Kyle can load this production league's earlier seasons from screenshots, check the printed reading, and accept it into the book, including people who do not return. A missing year does not block the weekly note. A new league has no import. Renewal itself is not built.

## Stories

- Story 11.1: Print one screenshot season
- Story 11.2: Accept a mapped season into the book
- Story 11.3: Leave a missing year out

## Requirements & Constraints

The backfill is for this production league only. A new league has no historical import. Its book starts with its first season in the app. A season with no screenshot is omitted. That gap does not block go-live or the weekly commentary feature. Years Kyle has accepted are still written.

The tool prints what it read and writes nothing until Kyle accepts that reading, and only once every first name is mapped to a current member's league person or to a past member who still counts. An unmapped name blocks the write. Use the existing person for a mapped current member. Create a league person only for a past member who still counts and has no membership. That book-only person has no user and no login. Invite lists use memberships. At most one person points at a membership. History is joined on the league person, never on a first-name string, and a screenshot-only person gets no user account.

Each file is one season of first names across weeks. The filename is the season year. A cell that names a team is that person's pick. Reject a file whose year is the league's current season, and reject a plain CSV. The vision call sees the image only. That spend sits outside the weekly league ceiling. The tool does not call the commentary runner.

Outcome is the cell fill. Green is a win at 1 point. Pale blue is a win against the jailed team at 2 points. Red with a team is a loss at 0. Empty red is a real loss at 0, including for Biggest Loser, in the same class as a submitted loss. Yellow or orange is an invalid pick, counted as a loss at 0.

Imported years stay in place for a later renewal, including people who do not return. Building renewal is out of scope. A later renew adds a completed live season to the same history and leaves book-only people off the roster.

A comparison names the years the history actually contains. It does not say "league history" or "all-time." Existence means the history that was read. No page shows past-season win/loss records or past-season biggest-loser points as records. Member pages read only the current season.

## Technical Decisions

The reader stays on Kyle's machine. It need not be committed or deployed. It writes the app's league-person and book-row tables. It is not an in-app importer, and it does not keep a private store the checker cannot read. The vision model id is not chosen here.

Imported years are book rows, not Pick rows. A book row is unique on person, year, and week and stores the person, year, week, outcome, points, and the team when there is one. A league has many league persons. A league person links to at most one membership and has many book rows. Live weeks stay on the season and its picks. Columns stay snake_case. Primary keys stay cuid. These rows live in `prisma/` with the rest of the commentary model.

The checker reads one history joined on the league person. When the league has a live season for a year, that season's picks win and book rows for that year are ignored. Other years come from book rows. The app owns the league person. Before a commentary run, each current membership is linked to its person, creating that person when the membership has none. The local tool reuses that person for a mapped current member.

The host, database, Tuesday digest, and auth stay as they ship. The weekly path stays on the existing Vercel app. This epic adds no deployed import route.

## UX & Interaction Patterns

There is no visual design contract. The check is a printed grid of first name, week, fill, and team. Kyle reads that grid, then accepts. Nothing is written before that accept.

## Cross-Story Dependencies

Printing never writes. Accepting writes one fully mapped year. A missing file skips that year and still allows the other accepted years.

The weekly commentary epic reads this book as one history with the live season. An empty or partial book is valid, and the weekly note still runs. A live season replaces book rows for that year. This tool does not call that runner, and its vision spend does not count against the league ceiling.

Renewal is not built. The imported years and book-only people have to remain so a later renewal can keep them and still leave those people off the invite list.
