"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { UserAvatar } from "@/components/user/UserAvatar";

type UserIdentityCellProps = {
  displayName: string;
  imageUrl?: string | null;
  /** Defaults to body2 for table/list density. */
  typographyVariant?: "body1" | "body2";
};

/**
 * Shared name cell: list-size avatar + display name (photo or initials).
 */
export function UserIdentityCell({
  displayName,
  imageUrl = null,
  typographyVariant = "body2",
}: UserIdentityCellProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      title={displayName}
      sx={{ minWidth: 0, maxWidth: "100%" }}
    >
      {/* Decorative: visible name is in Typography; empty alt avoids double announcement. */}
      <UserAvatar
        displayName={displayName}
        imageUrl={imageUrl}
        size="list"
        alt=""
      />
      <Typography variant={typographyVariant} noWrap sx={{ minWidth: 0 }}>
        {displayName}
      </Typography>
    </Stack>
  );
}
