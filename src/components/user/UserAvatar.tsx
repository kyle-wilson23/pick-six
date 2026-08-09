"use client";

import Avatar from "@mui/material/Avatar";

import { userInitials } from "@/lib/avatar";

export type UserAvatarSize = "nav" | "profile" | "list";

const SIZE_PX: Record<UserAvatarSize, number> = {
  nav: 32,
  list: 28,
  profile: 88,
};

type UserAvatarProps = {
  displayName: string;
  imageUrl?: string | null;
  size?: UserAvatarSize;
  alt?: string;
};

export function UserAvatar({
  displayName,
  imageUrl,
  size = "nav",
  alt,
}: UserAvatarProps) {
  const px = SIZE_PX[size];
  const initials = userInitials(displayName);
  const src = imageUrl?.trim() || undefined;

  return (
    <Avatar
      src={src}
      alt={alt ?? displayName}
      sx={{
        width: px,
        height: px,
        bgcolor: "primary.dark",
        fontSize: size === "profile" ? "1.75rem" : "0.875rem",
        flexShrink: 0,
      }}
    >
      {initials}
    </Avatar>
  );
}
