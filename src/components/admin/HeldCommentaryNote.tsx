"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type HeldCommentaryNoteProps = {
  sentences: string[];
};

/** Printable sentences already chosen for this week. An empty list is a stop or a hidden note. */
export function HeldCommentaryNote({ sentences }: HeldCommentaryNoteProps) {
  if (sentences.length === 0) return null;

  return (
    <Stack component="ul" spacing={0.5} sx={{ my: 0, pl: 2.5 }}>
      {sentences.map((sentence, index) => (
        <Typography key={`${index}-${sentence}`} component="li" variant="body2">
          {sentence}
        </Typography>
      ))}
    </Stack>
  );
}
