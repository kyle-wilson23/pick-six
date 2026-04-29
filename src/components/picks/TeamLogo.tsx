"use client";

import Avatar from "@mui/material/Avatar";

const sizePx = { sm: 28, md: 36, lg: 44 };

function hashHue(abbreviation: string): number {
  let h = 0;
  for (let i = 0; i < abbreviation.length; i += 1) {
    h = (h * 31 + abbreviation.charCodeAt(i)) % 360;
  }
  return h;
}

export type TeamLogoProps = {
  abbreviation: string;
  teamName: string;
  size: "sm" | "md" | "lg";
  disabled?: boolean;
};

export function TeamLogo({ abbreviation, teamName, size, disabled }: TeamLogoProps) {
  const px = sizePx[size];
  const abbr = abbreviation.trim().toUpperCase().slice(0, 4);
  const hue = hashHue(abbr);
  const aria = `${abbr}: ${teamName}`;

  return (
    <Avatar
      sx={{
        width: px,
        height: px,
        fontSize: size === "lg" ? "1rem" : "0.85rem",
        fontWeight: 700,
        bgcolor: `hsla(${hue}, 45%, 42%, 1)`,
        color: "common.white",
        opacity: disabled ? 0.45 : 1,
      }}
      aria-label={aria}
    >
      {abbr}
    </Avatar>
  );
}
