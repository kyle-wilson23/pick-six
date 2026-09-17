"use client";

import { useRef, useState } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ADMIN_NOTE_MAX_LENGTH } from "@/lib/email/admin-note";

export type AdminNoteRecipientOption = {
  membershipId: string;
  displayName: string;
};

export type AdminOnDemandEmailCardProps = {
  leagueId: string;
  recipients: AdminNoteRecipientOption[];
};

type AdminNoteSendFailure = {
  membershipId: string;
  email: string;
  displayName: string;
  error: string;
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatAdminNoteFailureLine(failure: {
  displayName: string;
  email: string;
  error: string;
}): string {
  const who =
    failure.displayName.trim() === failure.email
      ? failure.email
      : `${failure.displayName} (${failure.email})`;
  return `${who} — ${failure.error}`;
}

export function adminNoteRecipientSummary(
  selectedCount: number,
  eligibleCount: number,
): string {
  if (eligibleCount > 0 && selectedCount === eligibleCount) {
    return "All users selected";
  }
  return `${selectedCount} users selected`;
}

export type OpenAdminNotePreviewResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Open a blank tab on the click gesture, then POST the note with `fetch` (same Origin
 * as Send Now). A form POST + `rel="noreferrer"` can send `Origin: null` and 403 CSRF.
 */
export async function openAdminNotePreview(
  leagueId: string,
  note: string,
): Promise<OpenAdminNotePreviewResult> {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    return { ok: false, message: "Pop-up blocked. Allow pop-ups to preview the email." };
  }

  try {
    const res = await fetch(
      `/api/leagues/${encodeURIComponent(leagueId)}/email/admin-note-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );

    if (!res.ok) {
      tab.close();
      const data = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return { ok: false, message: data?.error?.message ?? "Preview failed" };
    }

    const html = await res.text();
    tab.document.open();
    tab.document.write(html);
    tab.document.close();
    tab.opener = null;
    return { ok: true };
  } catch {
    tab.close();
    return { ok: false, message: "Preview failed" };
  }
}

function allRecipientIds(recipients: AdminNoteRecipientOption[]): string[] {
  return recipients.map((recipient) => recipient.membershipId);
}

export function AdminOnDemandEmailCard({
  leagueId,
  recipients,
}: AdminOnDemandEmailCardProps) {
  const eligibleIds = allRecipientIds(recipients);
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(eligibleIds);
  const [draftIds, setDraftIds] = useState<string[]>(eligibleIds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendFailures, setSendFailures] = useState<AdminNoteSendFailure[]>([]);

  const selectedEligibleIds = eligibleIds.filter((id) => selectedIds.includes(id));
  const trimmed = note.trim();
  const hasNote = trimmed.length > 0 && trimmed.length <= ADMIN_NOTE_MAX_LENGTH;
  const canSend = hasNote && selectedEligibleIds.length > 0;
  const sendUrl = `/api/leagues/${encodeURIComponent(leagueId)}/email/admin-note`;

  function clearSendFeedback() {
    setSendMessage(null);
    setSendInfo(null);
    setSendError(null);
    setSendFailures([]);
  }

  function openPicker() {
    setDraftIds([...selectedIds]);
    setPickerOpen(true);
  }

  function commitPicker() {
    setSelectedIds([...draftIds]);
    setPickerOpen(false);
    clearSendFeedback();
  }

  function toggleDraft(membershipId: string) {
    setDraftIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  async function handlePreview() {
    if (!hasNote) {
      return;
    }
    clearSendFeedback();
    const result = await openAdminNotePreview(leagueId, note);
    if (!result.ok) {
      setSendError(result.message);
    }
  }

  async function handleSend() {
    if (!canSend || sendingRef.current) {
      return;
    }
    sendingRef.current = true;
    setSending(true);
    clearSendFeedback();
    try {
      const recipientMembershipIds = selectedEligibleIds;
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, recipientMembershipIds }),
      });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        sentAt?: string | null;
        suppressed?: boolean;
        wouldSendCount?: number;
        failures?: AdminNoteSendFailure[];
        error?: { code: string; message: string };
      };

      if (res.status === 429) {
        setSendError(data.error?.message ?? "Too many requests. Try again in a few minutes.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Send failed");
      }

      if (data.suppressed) {
        setSendInfo(
          `Rehearsal sends are suppressed (TEST_LEAGUE_EMAIL_MODE=suppress) — would have reached ${data.wouldSendCount ?? 0} member(s). No email was sent.`,
        );
        return;
      }

      const sent = data.sent ?? 0;
      const failed = data.failed ?? 0;
      const failures = data.failures ?? [];

      if (sent === 0) {
        setSendFailures(failures);
        setSendError(
          failed > 0
            ? `Send failed — ${failed} member${failed > 1 ? "s" : ""} could not be reached. No emails were delivered.`
            : "No members to send to.",
        );
        return;
      }

      if (failed > 0) {
        const when = data.sentAt ? formatSentAt(data.sentAt) : "just now";
        setSendFailures(failures);
        setSendError(`Sent at ${when} — ${sent} sent, ${failed} failed.`);
      } else {
        const when = data.sentAt ? formatSentAt(data.sentAt) : "just now";
        setSendMessage(
          `Sent at ${when} — ${sent} member${sent > 1 ? "s" : ""} reached.`,
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" component="h2">
            Message participants
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sends immediately — not the weekly digest.
          </Typography>
        </Stack>

        <TextField
          label="Note for participants"
          multiline
          minRows={4}
          fullWidth
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            clearSendFeedback();
          }}
          disabled={sending}
          placeholder="Write a message to send now…"
          slotProps={{ htmlInput: { maxLength: ADMIN_NOTE_MAX_LENGTH } }}
        />

        <Typography variant="body2" color="text.secondary">
          {adminNoteRecipientSummary(selectedEligibleIds.length, recipients.length)}
        </Typography>

        {sendMessage != null ? <Alert severity="success">{sendMessage}</Alert> : null}
        {sendInfo != null ? <Alert severity="info">{sendInfo}</Alert> : null}
        {sendError != null ? (
          <Alert severity="warning">
            {sendFailures.length === 0 ? (
              sendError
            ) : (
              <Stack spacing={1}>
                <Typography component="p" variant="body2">
                  {sendError}
                </Typography>
                <Typography component="p" variant="body2">
                  These never reached Resend (rejected or skipped before delivery):
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
                  {sendFailures.map((failure) => (
                    <Typography
                      key={failure.membershipId}
                      component="li"
                      variant="body2"
                    >
                      {formatAdminNoteFailureLine(failure)}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            )}
          </Alert>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            color="secondary"
            onClick={openPicker}
            disabled={sending}
            sx={{ whiteSpace: "nowrap" }}
          >
            Edit recipients
          </Button>
          <Button
            variant="outlined"
            color="info"
            onClick={() => void handlePreview()}
            disabled={!hasNote || sending}
            sx={{ whiteSpace: "nowrap" }}
          >
            Save & Preview
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void handleSend()}
            disabled={!canSend || sending}
          >
            {sending ? "Sending…" : "Send Now"}
          </Button>
        </Stack>
      </Stack>

      <Dialog
        open={pickerOpen}
        onClose={commitPicker}
        aria-labelledby="edit-recipients-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="edit-recipients-title">Edit recipients</DialogTitle>
        <DialogContent>
          <Stack spacing={0.5} sx={{ pt: 1 }}>
            {recipients.map((recipient) => (
              <FormControlLabel
                key={recipient.membershipId}
                control={
                  <Checkbox
                    checked={draftIds.includes(recipient.membershipId)}
                    onChange={() => toggleDraft(recipient.membershipId)}
                  />
                }
                label={recipient.displayName}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={commitPicker}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
