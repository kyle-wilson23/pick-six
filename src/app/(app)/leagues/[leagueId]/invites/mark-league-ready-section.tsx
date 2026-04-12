"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type ApiError = { error?: { code?: string; message?: string } };

type Props = {
  leagueId: string;
  isAdmin: boolean;
  /** ISO string or null when not yet initialized */
  initialPreSeasonInitializedAt: string | null;
  seasonRowExists: boolean;
};

export function MarkLeagueReadySection({
  leagueId,
  isAdmin,
  initialPreSeasonInitializedAt,
  seasonRowExists,
}: Props) {
  const [preSeasonInitializedAt, setPreSeasonInitializedAt] = useState<string | null>(
    initialPreSeasonInitializedAt,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isReady = preSeasonInitializedAt !== null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/pre-season-init`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? (data as ApiError).error?.message
            : null;
        setErrorMessage(msg ?? "Could not update league");
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "preSeasonInitializedAt" in data &&
        typeof (data as { preSeasonInitializedAt: unknown }).preSeasonInitializedAt === "string"
      ) {
        setPreSeasonInitializedAt((data as { preSeasonInitializedAt: string }).preSeasonInitializedAt);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!seasonRowExists) {
    return (
      <Alert severity="warning">
        No season record was found for the current NFL year. You can still send invitations, but
        pre-season initialization is unavailable until a season row exists.
      </Alert>
    );
  }

  return (
    <Stack spacing={2} component={isAdmin && !isReady ? "form" : "div"} onSubmit={isAdmin && !isReady ? onSubmit : undefined}>
      <Typography variant="subtitle1" component="h2">
        Season readiness
      </Typography>
      {isReady ? (
        <Alert severity="success">
          This league is marked <strong>ready for the season</strong>. Pre-season setup for the
          current NFL year is complete; when weekly picks and league automation are available in the
          app, they can run for this season.
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Pre-season setup is still open: invitations and roster changes can continue. When you are
          ready, confirm below so the league is treated as initialized for the current NFL season
          year.
        </Typography>
      )}
      {errorMessage ? (
        <Typography variant="body2" color="error">
          {errorMessage}
        </Typography>
      ) : null}
      {isAdmin && !isReady ? (
        <Button type="submit" variant="outlined" disabled={submitting}>
          {submitting ? "Saving…" : "Mark league ready for season"}
        </Button>
      ) : null}
      {!isAdmin && !isReady ? (
        <Typography variant="body2" color="text.secondary">
          Only a league admin can mark the league ready for the season.
        </Typography>
      ) : null}
    </Stack>
  );
}
