#!/usr/bin/env node
/**
 * Calls `POST /api/admin/nfl/sync-schedule` with bearer auth (Story 3.9).
 * Requires a running app and the same secrets as browser-free odds automation.
 *
 * Usage:
 *   SYNC_SCHEDULE_BASE_URL=http://localhost:3000 ODDS_SNAPSHOT_SECRET=... node scripts/sync-nfl-schedule.mjs
 * Optional: NFL_SEASON_YEAR=2026 (else server uses `getCurrentNflSeasonYear()`).
 */

const base = (process.env.SYNC_SCHEDULE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.ODDS_SNAPSHOT_SECRET?.trim();
if (!secret) {
  console.error("ODDS_SNAPSHOT_SECRET is required");
  process.exit(1);
}

const yearRaw = process.env.NFL_SEASON_YEAR?.trim();
if (yearRaw) {
  const yearNum = Number(yearRaw);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    console.error(`NFL_SEASON_YEAR must be an integer between 2000 and 2100 (got: ${yearRaw})`);
    process.exit(1);
  }
}
const body = yearRaw ? { nflSeasonYear: Number(yearRaw) } : {};

let res;
try {
  res = await fetch(`${base}/api/admin/nfl/sync-schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
} catch (e) {
  console.error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const text = await res.text();
process.stdout.write(`${res.status} ${text}\n`);
process.exit(res.ok ? 0 : 1);
