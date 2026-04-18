'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ApiError = { error?: { code?: string; message?: string } };

type DeleteLeagueDialogProps = {
  leagueId: string;
  leagueName: string;
};

const CONFIRM_TOKEN = 'delete';

export function DeleteLeagueDialog({
  leagueId,
  leagueName,
}: DeleteLeagueDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = confirmText === CONFIRM_TOKEN;

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setConfirmText('');
    setErrorMessage(null);
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: 'DELETE' });
      if (res.ok) {
        router.replace('/leagues');
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      const msg =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as ApiError).error?.message === 'string'
          ? (data as ApiError).error!.message!
          : 'Request failed';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        color='error'
        variant='outlined'
        onClick={() => setOpen(true)}
      >
        Delete league
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>Delete league permanently?</DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            sx={{ pt: 1 }}
          >
            <Typography
              variant='body2'
              color='text.secondary'
            >
              This cannot be undone. The league <strong>{leagueName}</strong>{' '}
              and all data scoped to it (members, seasons, invitations, and
              future league-scoped data) will be removed permanently. User
              accounts are not deleted.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label={`Type ${CONFIRM_TOKEN} to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={submitting}
              error={Boolean(errorMessage)}
              helperText={errorMessage}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            color='error'
            variant='contained'
            disabled={!canSubmit || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
