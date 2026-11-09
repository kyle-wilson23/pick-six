# Reconcile — historical cell legend

Compared `historical-cell-legend.md` to `ARCHITECTURE-SPINE.md`. Tone ignored. Spine and legend were not edited.

## Misses

1. **The filename is the season year.** The legend says each file is one season and the filename is the season year. AD-9 reads each season screenshot and a missing file omits that year. A book row stores a year. Nothing says that year is the filename. The naming table's "NFL season year" is the commentary-run key.

2. **Screenshot rows are first names.** The legend says each file is one season of first names across weeks. AD-9's grid is name, week, fill, and team, so season and week landed. AD-3 only forbids joining on a first-name string. The import rule never says the row label is a first name.

3. **Empty red is the same class as a submitted loss, including Biggest Loser.** The legend: no team selected; a real loss, including Biggest Loser, in the same class as a submitted loss; 0 points. AD-9 says empty red is a real loss with no team at 0. No team, real loss, and 0 landed. Same class as a submitted loss did not. Biggest Loser did not. The app already ranks Biggest Loser on scored losses and keeps a week with no pick as a missed week, so those two clauses are the constraint.

4. **No app page shows past-season win/loss records or past-season biggest loser points.** AD-2 says member pages read only the current season. That is narrower than every app page, and it never names those two displays. AD-10's admin email screen is an app page and is not held to this.

## Landed

Cell fill is the import outcome. A team named in a cell is that person's pick. The files are not the current season. A plain CSV is rejected. The outcomes stay in the loaded book for the Tuesday digest. Kyle checks a printed reading before any write. Green is a win at 1. Pale blue is a win against the jailed team at 2. Red with a team is a loss at 0. Yellow or orange is an invalid pick counted as a loss at 0.
