import "server-only";

/**
 * Rule C (sprint change proposal 2026-09-02): weekly reminders are anchored to the week's FR26
 * pick deadline, never to a weekday.
 *
 * Two daily ticks (11:00 and 20:00 UTC) both evaluate both slots; a slot fires on the first tick at
 * or after its anchor and is then suppressed by its `sentAt` column for the rest of the week. Do
 * **not** reintroduce weekday gating here — the old fixed Wed/Thu windows sent zero reminders for
 * 2026 Weeks 12 and 18, whose deadlines fall on a Wednesday evening and a Sunday midday.
 */

/** Slot 1 is the heads-up reminder; slot 2 is the last call before lock. */
export type ReminderSlot = 1 | 2;

export const REMINDER_SLOTS: readonly ReminderSlot[] = [1, 2];

/** Hours before the deadline at which each slot becomes eligible to send. */
export const REMINDER_SLOT_LEAD_HOURS: Record<ReminderSlot, number> = { 1: 48, 2: 12 };

/**
 * Historical weekday column names, reused as slot stamps. Do not rename — no migration.
 * Slot 1 → `wednesdayReminderSentAt`; slot 2 → `thursdayReminderSentAt`.
 */
export const REMINDER_SLOT_SENT_AT_FIELD = {
  1: "wednesdayReminderSentAt",
  2: "thursdayReminderSentAt",
} as const satisfies Record<ReminderSlot, "wednesdayReminderSentAt" | "thursdayReminderSentAt">;

const MS_PER_HOUR = 60 * 60 * 1000;

export type ReminderSkipReason =
  | "missing_deadline"
  | "past_deadline"
  | "already_sent"
  | "not_due";

export type ReminderSendDecision =
  | { send: true }
  | { send: false; reason: ReminderSkipReason };

/**
 * Universal past-deadline guard, shared with the Tuesday digest: no automated email may go out once
 * the week is locked. Strict `>` — an email landing exactly at the deadline is still legitimate.
 * An unknown deadline is never "past".
 */
export function isPastPickDeadline(deadline: Date | null, now: Date): boolean {
  return deadline != null && now.getTime() > deadline.getTime();
}

/** The instant `slot` becomes eligible: `deadline − REMINDER_SLOT_LEAD_HOURS[slot]`. */
export function reminderSlotAnchorUtc(slot: ReminderSlot, deadline: Date): Date {
  return new Date(deadline.getTime() - REMINDER_SLOT_LEAD_HOURS[slot] * MS_PER_HOUR);
}

/**
 * Whether a tick running at `now` should send `slot` for a week locking at `deadline`.
 *
 * "First tick at or after the anchor" falls out of the combination of the anchor test and
 * `alreadySentAt`: every later tick in the window is eligible by time and suppressed by the stamp.
 * That makes the stamp load-bearing now that ticks are daily rather than weekly.
 */
export function shouldSendWeeklyReminder(args: {
  slot: ReminderSlot;
  deadline: Date | null;
  now: Date;
  alreadySentAt: Date | null;
}): ReminderSendDecision {
  const { slot, deadline, now, alreadySentAt } = args;

  if (deadline == null) {
    return { send: false, reason: "missing_deadline" };
  }
  if (isPastPickDeadline(deadline, now)) {
    return { send: false, reason: "past_deadline" };
  }
  if (alreadySentAt != null) {
    return { send: false, reason: "already_sent" };
  }
  if (now.getTime() < reminderSlotAnchorUtc(slot, deadline).getTime()) {
    return { send: false, reason: "not_due" };
  }
  return { send: true };
}

const SKIP_REASON_PRECEDENCE: readonly ReminderSkipReason[] = [
  "missing_deadline",
  "past_deadline",
  "already_sent",
  "not_due",
];

/**
 * Collapses one league's per-slot skip reasons into the single most informative one for counters
 * and logs — schedule problems outrank lock state, which outranks routine "nothing due yet".
 */
export function summarizeReminderSkip(
  reasons: readonly ReminderSkipReason[],
): ReminderSkipReason | null {
  for (const reason of SKIP_REASON_PRECEDENCE) {
    if (reasons.includes(reason)) {
      return reason;
    }
  }
  return null;
}
