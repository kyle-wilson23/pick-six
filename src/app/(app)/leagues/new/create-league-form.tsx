"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { DEFAULT_SIMULATION_WEEK_COUNT } from "@/lib/league/simulation-week";

const WEEK_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 1);

type ApiError = { error?: { code?: string; message?: string } };

type CreateLeagueFormProps = {
  allowTestLeagues: boolean;
};

export function CreateLeagueForm({ allowTestLeagues }: CreateLeagueFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [firstCompetitionWeek, setFirstCompetitionWeek] = useState(1);
  const [isTestLeague, setIsTestLeague] = useState(false);
  const [simulationWeekCount, setSimulationWeekCount] = useState(DEFAULT_SIMULATION_WEEK_COUNT);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const creatingTestLeague = allowTestLeagues ? isTestLeague : false;
      const res = await fetch("/api/leagues", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          firstCompetitionWeek,
          isTestLeague: creatingTestLeague,
          ...(creatingTestLeague ? { simulationWeekCount } : {}),
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? (data as ApiError).error?.message
            : null;
        setErrorMessage(msg ?? "Could not create league");
        return;
      }
      if (data && typeof data === "object" && "id" in data && typeof (data as { id: unknown }).id === "string") {
        router.push(`/leagues/${(data as { id: string }).id}/invites`);
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2} onSubmit={onSubmit}>
      <TextField
        label="League name"
        name="name"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        required
        fullWidth
        autoComplete="off"
      />
      <FormControl fullWidth>
        <InputLabel id="first-week-label">First competition week</InputLabel>
        <Select
          labelId="first-week-label"
          label="First competition week"
          value={firstCompetitionWeek}
          onChange={(ev) => setFirstCompetitionWeek(Number(ev.target.value))}
        >
          {WEEK_OPTIONS.map((w) => (
            <MenuItem key={w} value={w}>
              Week {w}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {allowTestLeagues ? (
        <FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={isTestLeague}
                onChange={(ev) => setIsTestLeague(ev.target.checked)}
                name="isTestLeague"
              />
            }
            label="Test / rehearsal league"
          />
          <FormHelperText>
            For practice data only — not your real season league. This cannot be changed after
            creation; start a new production league for the real season.
          </FormHelperText>
        </FormControl>
      ) : null}
      {allowTestLeagues && isTestLeague ? (
        <FormControl fullWidth>
          <InputLabel id="simulation-week-count-label">Simulation week count</InputLabel>
          <Select
            labelId="simulation-week-count-label"
            label="Simulation week count"
            value={simulationWeekCount}
            onChange={(ev) => setSimulationWeekCount(Number(ev.target.value))}
          >
            {WEEK_OPTIONS.map((w) => (
              <MenuItem key={w} value={w}>
                {w} week{w === 1 ? "" : "s"}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            How many weeks this rehearsal will run. Recommended: 4–6 weeks.
          </FormHelperText>
        </FormControl>
      ) : null}
      {errorMessage ? (
        <Typography variant="body2" color="error">
          {errorMessage}
        </Typography>
      ) : null}
      <Button type="submit" variant="contained" disabled={submitting}>
        {submitting ? "Creating…" : "Create league"}
      </Button>
    </Stack>
  );
}
