# Spec reconcile — AI weekly results commentary

Compared the capability contract (`_bmad-output/specs/spec-ai-weekly-results-commentary/SPEC.md` and companion `historical-cell-legend.md`) to `ARCHITECTURE-SPINE.md`. Neither file was edited.

Tone was ignored. A gap counts only when the spine does not bind the requirement and two implementers could ship incompatible behavior. Rules the spine states on purpose — quiet line only after a normal finish with zero confirms, scores send on failure, claim predicates deferred — are not misses.

**6 real misses.**

## 1. Feature flag starts off

- **Spec location:** CAP-1 success — "Every league starts off."
- **Dropped:** The on/off flag's initial value. AD-8 binds who may write it, and that the ceiling defaults to $1. AD-10 binds debug off until Kyle turns it on. No rule binds the feature flag default.
- **Implementers diverge:** Yes. One schema defaults the flag off, so a league spends nothing until an admin opts in. Another defaults it on, so every league gets a run and a charge on the next delivering send.

## 2. Complete name mapping before import

- **Spec location:** CAP-4 success — "It runs only after the admin has mapped every first name to a current member or a past member who still counts."
- **Dropped:** The pre-write gate and its targets. AD-3 binds the join (league person, not a first-name string) and that a book-only person has no login. AD-9 binds print, then Kyle's accept, then write. Neither says every first name is mapped first, and neither limits the target to a current member or a past member who still counts.
- **Implementers diverge:** Yes. One tool refuses to write while any name is unmapped, and links a current member onto the same person as this season. Another mints a book-only person per distinct first name and never links current memberships, so the checker cannot see one streak. Another matches on the name string at import time.

## 3. Filename is the season year

- **Spec location:** CAP-4 success; Constraints (screenshot bullet); `historical-cell-legend.md` opening — "The filename is the season year."
- **Dropped:** Where the book-row year comes from. AD-9 reads a season screenshot and never says the year is the filename.
- **Implementers diverge:** Yes. One keys the year from the filename. Another takes a typed year or a year read off the image. The same file becomes different seasons, and AD-11 then names different years.

## 4. Screenshot files are not the current season

- **Spec location:** CAP-4 success — "None of the files is the current season in the app." Same sentence in Constraints and in `historical-cell-legend.md`.
- **Dropped:** Exclusion of a file whose year is the app's current season. AD-2 reads book rows plus every live season, and does not stop that season from also being stored as book rows.
- **Implementers diverge:** Yes. One refuses a current-season file. Another imports it. The checker then counts that year's weeks twice.

## 5. No page shows past-season records

- **Spec location:** Constraints (surfaces bullet) — "No page shows past-season win/loss records or past-season biggest loser points as records." Same ban in Non-goals (two bullets), the success signal, and `historical-cell-legend.md` ("No app page shows past-season win/loss records or past-season biggest loser points.").
- **Dropped:** The any-page display ban. AD-2 was shaped as a history join and only says "Member pages read only the current season." AD-10 only keeps commentary off member pages so the admin email screen can show a debug week. The records ban is not the commentary ban: the digest may talk about the book, and pages still may not show past-season win/loss or biggest-loser points as records. That sentence is not in any AD, convention, or Deferred item.
- **Implementers diverge:** Yes. One leaves book rows to the checker and the local tool. Another adds an admin or other page that renders imported win/loss or biggest-loser points as records. Both can satisfy AD-2.

This is the quiet drop. Debug review split surfaces into member pages versus the admin email screen. The older ban on past-season win/loss and biggest-loser points, on every page, did not fit that shape and never became a rule. "Member pages stay on the current season" did land.

## 6. Empty red counts for Biggest Loser

- **Spec location:** Constraints (screenshot bullet) — "Empty red is a real loss at 0 points, including for Biggest Loser." `historical-cell-legend.md` empty-red row — "A real loss, including Biggest Loser, in the same class as a submitted loss."
- **Dropped:** Biggest Loser eligibility. AD-9 keeps the points: empty red is a real loss with no team at 0. It drops "including for Biggest Loser" and "same class as a submitted loss." "Cell fill follows the historical legend" then restates a shorter list, so the inlined rule looks complete. The deferred predicate catalog does not cover this; it is a property of the cell.
- **Implementers diverge:** Yes. One counts a no-team red cell toward Biggest Loser, same as a submitted loss. Another skips rows with no team. The two checkers confirm different Biggest Loser claims.

## Checked and not counted

These are in the spine, or they do not leave implementers a free choice: one run per week and no member prompt; app-written names, numbers, and the exact quiet line; unconfirmed comparisons dropped; no padding past confirmed items; $1 default ceiling that Kyle replaces and an admin cannot; stop at 3 confirms or the ceiling; debug off until Kyle turns it on, run still stored, digest omits it, admin email screen shows the stored lines and does not call the model; no passwords or sessions in the view; missing screenshot omits that year and does not block the feature; named years, never "league history" or "all-time"; imported years survive a later renew, including people who do not return; new leagues get no in-app importer (AD-9); cell colors other than the Biggest Loser clause; CSV rejected. AD-5's split between a normal quiet week and an abnormal stop is a stated rule, not a hole.
