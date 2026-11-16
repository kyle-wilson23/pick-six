"use client";

import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CommentaryCeilingFieldProps = {
  leagueId: string;
  ceilingUsd: string;
};

type ApiError = { error?: { message?: string } };

function errorMessageFrom(data: unknown): string {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? (data as ApiError).error?.message
      : undefined;
  return typeof message === "string" ? message : "Request failed";
}

export function CommentaryCeilingField({ leagueId, ceilingUsd }: CommentaryCeilingFieldProps) {
  const router = useRouter();
  const [value, setValue] = useState(ceilingUsd);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(ceilingUsd);
  }, [ceilingUsd]);

  async function onSave() {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commentary-ceiling`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryWeeklyCeilingUsd: value }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(errorMessageFrom(data));
        return;
      }
      const saved =
        typeof data === "object" &&
        data !== null &&
        "commentaryWeeklyCeilingUsd" in data &&
        typeof (data as { commentaryWeeklyCeilingUsd: unknown }).commentaryWeeklyCeilingUsd ===
          "string"
          ? (data as { commentaryWeeklyCeilingUsd: string }).commentaryWeeklyCeilingUsd
          : null;
      if (saved == null) {
        setErrorMessage("Request failed");
        return;
      }
      setValue(saved);
      router.refresh();
    } catch {
      setErrorMessage("Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={1} alignItems="flex-start">
      <TextField
        label="Weekly dollar ceiling"
        name="commentaryWeeklyCeilingUsd"
        value={value}
        size="small"
        disabled={saving}
        onChange={(event) => setValue(event.target.value)}
        slotProps={{
          htmlInput: { inputMode: "decimal" },
          input: {
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          },
        }}
      />
      <Button type="button" variant="contained" disabled={saving} onClick={() => void onSave()}>
        Save ceiling
      </Button>
      {errorMessage ? (
        <Typography variant="body2" color="error" role="alert">
          {errorMessage}
        </Typography>
      ) : null}
    </Stack>
  );
}
