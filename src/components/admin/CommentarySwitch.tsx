"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CommentarySwitchProps = {
  leagueId: string;
  commentaryEnabled: boolean;
};

type ApiError = { error?: { message?: string } };

function errorMessageFrom(data: unknown): string {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? (data as ApiError).error?.message
      : undefined;
  return typeof message === "string" ? message : "Request failed";
}

export function CommentarySwitch({ leagueId, commentaryEnabled }: CommentarySwitchProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(commentaryEnabled);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(commentaryEnabled);
  }, [commentaryEnabled]);

  async function onToggle(checked: boolean) {
    const previous = enabled;
    setEnabled(checked);
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commentary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryEnabled: checked }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnabled(previous);
        setErrorMessage(errorMessageFrom(data));
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "commentaryEnabled" in data &&
        typeof (data as { commentaryEnabled: unknown }).commentaryEnabled === "boolean"
      ) {
        setEnabled((data as { commentaryEnabled: boolean }).commentaryEnabled);
      }
      router.refresh();
    } catch {
      setEnabled(previous);
      setErrorMessage("Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={0.5}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={saving}
            name="commentaryEnabled"
            onChange={(_event, checked) => {
              void onToggle(checked);
            }}
          />
        }
        label="Weekly commentary"
      />
      {errorMessage ? (
        <Typography variant="body2" color="error" role="alert">
          {errorMessage}
        </Typography>
      ) : null}
    </Stack>
  );
}
