"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";

import { AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { REPORT_DESCRIPTION_MAX } from "@/lib/reports/report-form-schema";
import { readVisitTrail } from "@/lib/reports/visit-trail";

type ApiError = { error?: { code?: string; message?: string } };
type ApiOk = { ok?: boolean; screenshotOmitted?: boolean };

type ReportProblemDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function ReportProblemDialog({ open, onClose }: ReportProblemDialogProps) {
  const pathname = usePathname();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSubmit = description.trim().length > 0 && !submitting && successMessage == null;

  function resetForm() {
    setDescription("");
    setFileName(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  function handleClose() {
    if (submitting) return;
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    const trimmed = description.trim();
    if (!trimmed) {
      setErrorMessage("Please describe the problem.");
      return;
    }
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      let trail: string[] = [];
      try {
        trail = readVisitTrail(sessionStorage);
      } catch {
        trail = [];
      }
      const form = new FormData();
      form.set("description", trimmed);
      form.set("visitTrail", JSON.stringify(trail));
      form.set("pathname", pathname);
      form.set("userAgent", navigator.userAgent);
      form.set("viewportWidth", String(window.innerWidth));
      form.set("viewportHeight", String(window.innerHeight));
      const file = fileRef.current?.files?.[0];
      if (file) {
        form.set("screenshot", file);
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as ApiError).error?.message === "string"
            ? (data as ApiError).error!.message!
            : "We couldn't send your report. Please try again.";
        setErrorMessage(msg);
        return;
      }
      const omitted =
        typeof data === "object" &&
        data !== null &&
        (data as ApiOk).screenshotOmitted === true;
      setSuccessMessage(
        omitted
          ? "Thanks — we received your report, but the screenshot could not be attached."
          : "Thanks — we received your report. You won't get a reply, but we'll look at it.",
      );
    } catch {
      setErrorMessage("We couldn't send your report. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Report a problem</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {successMessage == null ? (
            <>
              <TextField
                label="What happened?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                multiline
                minRows={4}
                required
                fullWidth
                disabled={submitting}
                inputProps={{ maxLength: REPORT_DESCRIPTION_MAX }}
              />
              <Stack spacing={0.5}>
                <Button
                  variant="outlined"
                  component="label"
                  htmlFor={fileInputId}
                  disabled={submitting}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Attach screenshot (optional)
                </Button>
                <input
                  id={fileInputId}
                  ref={fileRef}
                  type="file"
                  accept={AVATAR_ALLOWED_MIME_TYPES.join(",")}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && file.size > AVATAR_MAX_BYTES) {
                      setErrorMessage("Image must be 5MB or smaller.");
                      event.target.value = "";
                      setFileName(null);
                      return;
                    }
                    setErrorMessage(null);
                    setFileName(file?.name ?? null);
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {fileName ?? "JPEG, PNG, or WebP · 5MB max"}
                </Typography>
              </Stack>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        {successMessage ? (
          <Button onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? "Sending…" : "Send report"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
