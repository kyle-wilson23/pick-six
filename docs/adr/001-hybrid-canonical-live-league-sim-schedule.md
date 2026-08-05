# ADR 001: Hybrid canonical live NFL schedule + league-scoped sim games

**Status:** Accepted  
**Date:** 2026-08-04  
**Spec:** `_bmad-output/implementation-artifacts/spec-hybrid-canonical-live-league-sim-schedule.md`

## Context

Test-league rehearsal fixtures previously shared the global `NflGame` natural key with Odds-backed live sync. That caused uniqueness collisions, orphan-delete fights, and sim odds/jailed stamping the shared week — so a real league created after a test league could inherit or fight fixture matchups.

## Decision

**Hybrid Option B:**

| Concern | Store |
|---------|--------|
| Live / Odds schedule, results, production odds, global jailed | Canonical `NflGame`, `NflGameOddsLine`, `NflWeekJailedTeam` |
| Test-league schedule, sim odds, sim jailed | `LeagueSimGame`, `LeagueSimGameOddsLine` (+ `LeagueSimOddsSnapshotRun`), `LeagueWeekJailedTeam` |

All league-context game reads go through `resolveGamesForLeague` (`src/lib/nfl/resolve-games-for-league.ts`): real → canonical; test → that league’s sim rows (`source: "canonical" | "sim"`).

Sim data cascades with `League` delete (`onDelete: Cascade`). Odds schedule sync remains **canonical-only** and never reads/deletes sim tables.

## Consequences

- Real leagues after test leagues see the live slate (or empty until synced) — never fixture-only matchups.
- Two test leagues have independent sim rows.
- Test jailed cannot overwrite global `NflWeekJailedTeam`.
- Fixture JSON volume (~4 games/week) and Odds cron auto-sync are **deferred** — see `_bmad-output/implementation-artifacts/deferred-work.md`.

## Alternatives considered

- **Option A** (per-real-league copies of the live slate): rejected for this change — multiplies storage and sync complexity.
- **Provenance-only coexistence** on one mutable `NflGame` keyspace: rejected as long-term design (still collides on natural key / orphan-delete).
