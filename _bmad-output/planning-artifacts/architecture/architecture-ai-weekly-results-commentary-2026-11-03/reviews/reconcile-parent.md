# Reconcile — parent architecture

Parent: `_bmad-output/planning-artifacts/architecture.md` (complete). Shipped digest, schema, and `package.json` were used only to confirm what that document already settled. Neither document was edited.

## Verdict

No contradictions. The spine does not re-decide the stack, the Tuesday digest, multi-tenancy, auth, Prisma, Vercel cron, or member-facing history.

## Checked

- **Stack.** Next 16.2.2, React 19.2.4, Prisma 7.8.0, Zod 4.3.6, and MUI 7.3.9 match `package.json`. Neon and Vercel stay the existing projects. Auth stays as the app ships it. The Vercel AI SDK is a new server-side caller for this feature, not a replacement of the host, database, or auth.
- **Tuesday digest.** The run key is league, NFL season year, and week — the `LeagueWeekEmailConfig` unique key. Cron and the admin send stay the triggers. A suppressed test-league send does not create a run or spend. Later sends read the stored run. The scores mail still sends if commentary stops. The spine does not retarget the digest week: that number remains the open pick week on the existing row, and completed live weeks stay inside the history the checker reads.
- **Multi-tenancy.** On/off, debug, and the ceiling are per league. Persons, book rows, and runs hang off the league. Invite lists stay on memberships.
- **Auth.** No second login system. A book-only person is not a user. The debug read stays on the league admin email screen. Kyle writing the ceiling and the debug flag is this feature's extra writer; it does not replace admin and member roles.
- **Prisma.** Columns stay snake_case. Primary keys stay cuid. New data is app tables. Imported years are book rows, so `Pick.teamId` and `leagueMembershipId` stay required.
- **Vercel cron.** No new schedule and no second scheduler. The runner sits on the existing delivering send.
- **Member-facing history.** Member pages stay on the current season. Commentary is not a member page, and past-season records are not a standings or history surface.

## Not a silent re-decision

Leaving out CSRF, `CRON_SECRET`, league-delete cascade, `America/New_York`, and the Auth.js session strategy does not replace those parent rules. The spine does not restate them, and it does not choose something else.
