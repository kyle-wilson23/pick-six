"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const WEEK_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 1);

type ApiError = { error?: { code?: string; message?: string } };

export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [firstCompetitionWeek, setFirstCompetitionWeek] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, firstCompetitionWeek }),
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
      router.push("/dashboard");
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
