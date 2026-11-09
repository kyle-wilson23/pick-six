---
id: SPEC-ai-weekly-results-commentary
companions:
  - historical-cell-legend.md
  - ../../planning-artifacts/architecture/architecture-ai-weekly-results-commentary-2026-11-03/ARCHITECTURE-SPINE.md
sources:
  - ../../forge/ai-weekly-results-commentary/forged-idea.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# AI weekly results commentary

## Why

The Tuesday digest shows the week's scores and no note on what was rare. This adds a few confirmed observations against the league's loaded book, in that email, once the league turns the feature on. Kyle can hold that note off the digest and read it on the league admin email screen. The production league's earlier seasons exist as screenshots, so a record line in the email is false until those years are in the book. Member pages stay on the current season. Kyle pays for the model.

## Capabilities

- **CAP-1**
  - **intent:** A league admin can turn weekly results commentary on or off for that league.
  - **success:** Every league starts off. While off, the Tuesday digest includes no commentary, and the league adds nothing to that week's model spend. While on, that week's one run happens and spends. Members see it in the Tuesday digest only when debug is off.

- **CAP-2**
  - **intent:** An enabled league's Tuesday digest shows the lines the model wrote about the most impactful facts or broken records it found in this week or the loaded book.
  - **success:** That week's single run shows 0 to 3 lines and does not pad. The model writes each line. Each line carries the cells it depends on: league person, year, week, outcome, points, and the team when there is one. The app re-reads those cells. A line whose cells do not match is absent. A line that matches is stored as the model wrote it. When nothing is confirmed, the text is the app's fixed line: Quiet week. Nothing new for the record book. When debug is off, the Tuesday digest shows that text. When debug is on, the digest omits it. No member page shows it.

- **CAP-3**
  - **intent:** Kyle can set a weekly dollar ceiling for a league, and a league admin cannot.
  - **success:** The default ceiling is $1 per enabled league per week. A ceiling Kyle sets on that league replaces the default. The run stops at 3 confirmed items or at the ceiling in force, whichever comes first. A league admin can turn the feature on or off and cannot change the amount.

- **CAP-4**
  - **intent:** This production league can bring its past seasons into the book from screenshots, once, before go-live.
  - **success:** It runs only after the admin has mapped every first name to a current member or a past member who still counts. It prints what it read from each screenshot, and nothing is written until Kyle has checked that reading. The filename is the season year. None of the files is the current season in the app. A plain CSV is rejected.

- **CAP-5**
  - **intent:** Kyle can hold an enabled league's commentary out of the digest and read it on the league admin email screen.
  - **success:** Debug is off until Kyle turns it on. A league admin cannot change it. While debug is on, that week's one run still happens and still spends, the Tuesday digest has no commentary section, and the league admin email screen shows the stored lines. While debug is off, the digest shows the run and that screen does not show a second copy. Anyone who can open that league's admin screen can read a debug week. No member page shows the commentary.

## Constraints

- Each enabled league gets one commentary run per week. When debug is off, the Tuesday digest shows that run. When debug is on, the digest omits it and the league admin email screen shows the stored lines. The model chooses what to surface from this week or the loaded book, and members do not prompt it. It may not hunt past this week or the loaded book. It writes up to 3 lines, the ones it judges the most impactful facts or broken records. There is no catalog of record types. The 3-line cap and the league's dollar ceiling both stop the run.
- The dollar stop is the ceiling in force for that league. The default is $1 per enabled league per week. A ceiling Kyle sets on that league replaces the default.
- The model writes the commentary lines. The app does not rewrite a line whose cells match. The quiet-week line stays the app's. A line is dropped when a cited cell does not match the book, when the sentence says "league history" or "all-time," or when it compares years without naming them.
- The model's data access cannot read passwords or sessions.
- Members read commentary in the Tuesday digest only, and only when debug is off. The league admin email screen is the only app surface that shows it, and only while debug is on. That screen shows the stored lines and does not call the model. No member page shows the commentary. No page shows past-season win/loss records or past-season biggest loser points as records. Member pages stay on the current season. The loaded book feeds the run.
- A season with no screenshot is omitted and does not block go-live. If a year is missing, the line names the years it compared and does not say "league history" or "all-time." Existence means the loaded book. A missing year is not expected for this production league.
- A later renewal of this production league keeps the imported years, including people who do not return.
- A new league has no historical import. Its book starts with its first season in the app.
- Each screenshot is one season of first names across weeks. A cell that names a team is that person's pick. Historical outcome is the cell fill in `historical-cell-legend.md`. Empty red is a real loss at 0 points, including for Biggest Loser. Yellow or orange is an invalid pick, counts as a loss, and is 0 points. A plain CSV is the wrong file because it drops the color.
- How the feature is built is `ARCHITECTURE-SPINE.md`. Its AD numbers stay stable. A build that contradicts an AD is out of contract. This kernel does not restate those rules.

## Non-goals

- A closed catalog of record types.
- The app rewriting a confirmed line.
- The model writing the quiet-week line.
- An unbounded hunt.
- League admins setting the dollar amount.
- A database login that can see passwords and sessions.
- Spreadsheet import, or any historical import, for later leagues.
- Building league renewal. The imported years still have to survive a later renewal.
- Commentary on a member page.
- A league admin turning debug on or off.
- Past-season win/loss records on any app page.
- Past-season biggest loser points on any app page.
- Member prompts or a chat with the model.

## Success signal

For an enabled league with debug off, that week's one run is in the Tuesday digest: at most three lines stored as the model wrote them whose cited cells match the book, or exactly "Quiet week. Nothing new for the record book." With debug on, the digest has no commentary section and the league admin email screen shows those stored lines. The run has stopped at three items or at the ceiling in force. A league that is off adds no commentary and no spend. No member page shows the commentary. No page shows a past-season win/loss record or past-season biggest loser points as records. Before this production league goes live, Kyle has checked the screenshot seasons and they are in the book.
