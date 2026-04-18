"use client";

import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { firstCompetitionWeekLockedReason } from "@/lib/league/first-competition-week";

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

type ApiError = { error?: { code?: string; message?: string } };

type FirstCompetitionWeekSettingsProps = {
  leagueId: string;
  hasSeason: boolean;
  initialFirstCompetitionWeek: number;
  initialFirstCompetitionWeekLockedAt: string | null;
};

export function FirstCompetitionWeekSettings({
  leagueId,
  hasSeason,
  initialFirstCompetitionWeek,
  initialFirstCompetitionWeekLockedAt,
}: FirstCompetitionWeekSettingsProps) {
  const router = useRouter();
  const [week, setWeek] = useState(initialFirstCompetitionWeek);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/first-competition-week`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstCompetitionWeek: week }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as ApiError).error?.message === "string"
            ? (data as ApiError).error!.message!
            : "Request failed";
        setErrorMessage(msg);
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasSeason) {
    return (
      <Typography variant="body2" color="text.secondary">
        No season row for the current NFL year — first competition week cannot be edited until a season exists.
      </Typography>
    );
  }

  if (initialFirstCompetitionWeekLockedAt !== null) {
    const lockedAt = initialFirstCompetitionWeekLockedAt;
    return (
      <Stack spacing={1}>
        <Typography variant="body1">
          First competition week is <strong>NFL Week {initialFirstCompetitionWeek}</strong> (read-only).
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {firstCompetitionWeekLockedReason()} Locked at {new Date(lockedAt).toISOString()} (
          {new Date(lockedAt).toLocaleString()}).
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      <FormControl fullWidth size="small">
        <Select
          id="first-competition-week-select"
          value={week}
          onChange={(ev) => setWeek(Number(ev.target.value))}
          inputProps={{ "aria-labelledby": "first-competition-week-settings-label" }}
        >
          {WEEKS.map((w) => (
            <MenuItem key={w} value={w}>
              Week {w}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {errorMessage ? (
        <Typography variant="body2" color="error">
          {errorMessage}
        </Typography>
      ) : null}
      <Button type="submit" variant="contained" disabled={submitting || week === initialFirstCompetitionWeek}>
        {submitting ? "Saving…" : "Save week"}
      </Button>
      <Typography variant="caption" color="text.secondary">
        Picks and scoring apply from this NFL week onward. Earlier regular-season weeks are out of scope for this
        league. This can be changed until competition has started for the season (then it locks automatically).
      </Typography>
    </Stack>
  );
}
