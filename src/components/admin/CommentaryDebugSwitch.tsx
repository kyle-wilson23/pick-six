"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CommentaryDebugSwitchProps = {
  leagueId: string;
  commentaryDebug: boolean;
};

type ApiError = { error?: { message?: string } };

function errorMessageFrom(data: unknown): string {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? (data as ApiError).error?.message
      : undefined;
  return typeof message === "string" ? message : "Request failed";
}

export function CommentaryDebugSwitch({
  leagueId,
  commentaryDebug,
}: CommentaryDebugSwitchProps) {
  const router = useRouter();
  const [held, setHeld] = useState(commentaryDebug);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setHeld(commentaryDebug);
  }, [commentaryDebug]);

  async function onToggle(checked: boolean) {
    const previous = held;
    setHeld(checked);
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commentary-debug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryDebug: checked }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHeld(previous);
        setErrorMessage(errorMessageFrom(data));
        return;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "commentaryDebug" in data &&
        typeof (data as { commentaryDebug: unknown }).commentaryDebug === "boolean"
      ) {
        setHeld((data as { commentaryDebug: boolean }).commentaryDebug);
      }
      router.refresh();
    } catch {
      setHeld(previous);
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
            checked={held}
            disabled={saving}
            name="commentaryDebug"
            onChange={(_event, checked) => {
              void onToggle(checked);
            }}
          />
        }
        label="Hold the note"
      />
      {errorMessage ? (
        <Typography variant="body2" color="error" role="alert">
          {errorMessage}
        </Typography>
      ) : null}
    </Stack>
  );
}
