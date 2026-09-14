---
title: 'Admin weekly digest copy'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'one-shot'
---

# Admin weekly digest copy

## Intent

**Problem:** The weekly digest composer on the admin page does not say when the email actually goes out, and the Preview control already saves the note first without saying so.

**Approach:** Show “Sent on Tuesday evenings” beside the week title in the digest card, and rename the control to Save & Preview so the label matches save-then-open behavior.

## Suggested Review Order

**Schedule subtext**

- Week title plus cadence hint, associated for assistive tech
  [`AdminEmailComposer.tsx:236`](../../src/components/admin/AdminEmailComposer.tsx#L236)

**Save & Preview**

- Preview tab opens only after a successful save
  [`AdminEmailComposer.tsx:125`](../../src/components/admin/AdminEmailComposer.tsx#L125)

- Button label and nowrap so the longer text stays intact
  [`AdminEmailComposer.tsx:289`](../../src/components/admin/AdminEmailComposer.tsx#L289)

**Peripherals**

- Accessible name and failed-save coverage for the renamed control
  [`AdminEmailComposer.test.tsx:38`](../../src/components/admin/AdminEmailComposer.test.tsx#L38)

- Operator docs still named the old Preview button
  [`rehearsal-runbook.md:121`](../../docs/rehearsal-runbook.md#L121)
