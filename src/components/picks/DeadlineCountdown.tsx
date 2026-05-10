"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/system";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useMemo, useState } from "react";

import { LEAGUE_BUSINESS_TIMEZONE } from "@/lib/league/league-rules";
import { getCountdownVariant, type CountdownUrgency } from "@/lib/picks/countdown";

export type DeadlineCountdownProps = {
  /** ISO UTC string from the server-authoritative `pickDeadlineUtc`. */
  pickDeadlineUtc: string;
};

const URGENCY_TO_SX: Record<CountdownUrgency, {
  color: string;
  fontWeight: number;
  fontSize: string;
}> = {
  calm: { color: "text.secondary", fontWeight: 500, fontSize: "0.875rem" },
  elevated: { color: "warning.main", fontWeight: 600, fontSize: "0.95rem" },
  critical: { color: "error.main", fontWeight: 700, fontSize: "1.05rem" },
  passed: { color: "text.disabled", fontWeight: 500, fontSize: "0.875rem" },
};

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Story 3.7 — server-authoritative countdown (FR23). The server's `pickDeadlineUtc` is the truth;
 * this component only ticks the **display** and computes urgency bands per UX § DeadlineCountdown.
 */
export function DeadlineCountdown({ pickDeadlineUtc }: DeadlineCountdownProps) {
  const deadlineMs = useMemo(() => Date.parse(pickDeadlineUtc), [pickDeadlineUtc]);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(deadlineMs)) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof window.setTimeout>;

    const step = () => {
      if (cancelled) return;
      setNow(Date.now());
      const remaining = deadlineMs - Date.now();
      if (remaining <= 0) return;
      const ms = remaining <= ONE_HOUR_MS ? 1000 : 30_000;
      timeoutId = window.setTimeout(step, ms);
    };

    const remainingInitial = deadlineMs - Date.now();
    if (remainingInitial <= 0) {
      setNow(Date.now());
      return () => {
        cancelled = true;
      };
    }

    const initialMs = remainingInitial <= ONE_HOUR_MS ? 1000 : 30_000;
    timeoutId = window.setTimeout(step, initialMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deadlineMs]);

  if (!Number.isFinite(deadlineMs)) {
    return null;
  }

  const remainingMs = deadlineMs - now;
  const variant = getCountdownVariant(remainingMs);
  const styles = URGENCY_TO_SX[variant.urgency];

  let easternLabel: string | null = null;
  try {
    const parsed = parseISO(pickDeadlineUtc);
    if (!Number.isNaN(parsed.getTime())) {
      easternLabel = formatInTimeZone(parsed, LEAGUE_BUSINESS_TIMEZONE, "EEE h:mm a 'ET'");
    }
  } catch {
    easternLabel = null;
  }

  const isPassed = variant.urgency === "passed";
  const headlinePrefix = isPassed ? "Picks closed" : "Picks lock in";

  return (
    <Stack
      role="timer"
      aria-live="polite"
      aria-atomic
      spacing={0.25}
      sx={{
        py: 1,
        px: 1.25,
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="caption" color="text.secondary" component="span">
        {headlinePrefix}
        {easternLabel ? ` · ${easternLabel}` : ""}
      </Typography>
      <Typography
        component="span"
        sx={{
          color: styles.color,
          fontWeight: styles.fontWeight,
          fontSize: styles.fontSize,
          lineHeight: 1.2,
          ...(variant.urgency === "critical" && {
            animation: `${pulse} 1.6s ease-in-out infinite`,
          }),
        }}
      >
        {variant.label}
      </Typography>
    </Stack>
  );
}
