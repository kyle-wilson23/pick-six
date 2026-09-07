---
title: 'Admin reminder status labels'
type: 'bugfix'
created: '2026-09-06'
status: 'done'
route: 'one-shot'
baseline_commit: '0dd25e70d98eb0d896d1089341b373057df2698a'
---

# Admin reminder status labels

## Intent

**Problem:** Reminder emails now fire on deadline-anchored slots, not a fixed Wednesday/Thursday cadence, but the admin Email automation status card still names those rows after weekdays.

**Approach:** Relabel the two status rows to First pick reminder and Final pick reminder. Keep existing status suffixes, including "— Pending (scheduled)". Do not change send buttons, API paths, or pending/missed gating.

## Suggested Review Order

**Status card copy**

- Slot 1/2 rows use First/Final names; weekday field names stay.
  [`AdminWeeklyEmailStatus.tsx:59`](../../src/components/admin/AdminWeeklyEmailStatus.tsx#L59)

- Pending (and other) suffixes still interpolate the job name.
  [`AdminWeeklyEmailStatus.tsx:41`](../../src/components/admin/AdminWeeklyEmailStatus.tsx#L41)

**Supporting**

- Distinct row states lock First vs Final mapping and the pending suffix.
  [`AdminWeeklyEmailStatus.test.tsx:25`](../../src/components/admin/AdminWeeklyEmailStatus.test.tsx#L25)

- Weekday gating remains deferred; labels no longer match those windows.
  [`deferred-work.md:17`](./deferred-work.md#L17)

- Spot-check table matches the new admin-card names.
  [`observability-ops-runbook.md:29`](../../docs/observability-ops-runbook.md#L29)
