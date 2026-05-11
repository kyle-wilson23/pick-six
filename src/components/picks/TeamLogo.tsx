"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import { useState } from "react";

import { resolveNflLogoSrc } from "@/lib/nfl/resolve-nfl-logo-src";

const sizePx = { sm: 24, md: 32, lg: 40 };

function hashHue(abbreviation: string): number {
  let h = 0;
  for (let i = 0; i < abbreviation.length; i += 1) {
    h = (h * 31 + abbreviation.charCodeAt(i)) % 360;
  }
  return h;
}

type LogoMarkProps = {
  abbreviation: string;
  teamName: string;
  size: "sm" | "md" | "lg";
  disabled?: boolean;
  jailed?: boolean;
};

/**
 * Holds logo load-error state. Parent sets `key` to `abbr` + resolved src so remount clears errors
 * when the team (or asset path) changes — avoids setState in useEffect.
 */
function LogoMark({ abbreviation, teamName, size, disabled, jailed }: LogoMarkProps) {
  const px = sizePx[size];
  const abbr = abbreviation.trim().toUpperCase().slice(0, 4);
  const hue = hashHue(abbr);
  const aria = `${abbr}: ${teamName}`;
  const alt = `${abbr}: ${teamName}`;
  const logoSrc = resolveNflLogoSrc({ abbreviation });
  const [imageFailed, setImageFailed] = useState(false);

  // Filter precedence: jailed (50% desat) is overridden by disabled/already-picked (70% gray + dim).
  const filter = disabled
    ? "grayscale(70%) saturate(0.5)"
    : jailed
      ? "grayscale(50%) saturate(0.5)"
      : "none";

  const showImage = logoSrc !== null && !imageFailed;

  return showImage ? (
    <Box
      sx={{
        width: px,
        height: px,
        position: "relative",
        borderRadius: "50%",
        overflow: "hidden",
        opacity: disabled ? 0.5 : 1,
        filter,
      }}
    >
      <Image
        src={logoSrc}
        alt={alt}
        width={px}
        height={px}
        sizes={`${px}px`}
        onError={() => setImageFailed(true)}
        draggable={false}
        style={{ objectFit: "cover" }}
      />
    </Box>
  ) : (
    <Avatar
      sx={{
        width: px,
        height: px,
        fontSize: size === "lg" ? "0.8rem" : "0.7rem",
        fontWeight: 700,
        bgcolor: `hsla(${hue}, 45%, 42%, 1)`,
        color: "common.white",
        opacity: disabled ? 0.5 : 1,
        filter,
      }}
      aria-label={aria}
    >
      {abbr}
    </Avatar>
  );
}

export type TeamLogoProps = {
  abbreviation: string;
  teamName: string;
  size: "sm" | "md" | "lg";
  /** Already-picked treatment: ~70% grayscale + 50% opacity (UX § Already-Picked Team Visual). */
  disabled?: boolean;
  /** Story 3.7 — jailed treatment: ~50% desaturation + warning-color "JAILED" overline tag. */
  jailed?: boolean;
  /**
   * Story 3.7 — overlay a small "PICKED WK X" overline tag on top of the avatar (used together
   * with `disabled`). Pass the OTHER week's number, e.g. 3 for "PICKED WK 3".
   */
  pickedWeekTag?: number;
};

export function TeamLogo({
  abbreviation,
  teamName,
  size,
  disabled,
  jailed,
  pickedWeekTag,
}: TeamLogoProps) {
  const abbr = abbreviation.trim().toUpperCase().slice(0, 4);
  const logoSrc = resolveNflLogoSrc({ abbreviation });
  const markKey = `${abbr}-${logoSrc ?? "abbr-only"}`;

  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <LogoMark
        key={markKey}
        abbreviation={abbreviation}
        teamName={teamName}
        size={size}
        disabled={disabled}
        jailed={jailed}
      />
      {jailed ? (
        <Typography
          component="span"
          variant="overline"
          aria-hidden
          sx={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            px: 0.5,
            lineHeight: 1.2,
            fontSize: "0.55rem",
            letterSpacing: 0.5,
            fontWeight: 700,
            bgcolor: "warning.main",
            color: "warning.contrastText",
            borderRadius: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          JAILED
        </Typography>
      ) : null}
      {!jailed && typeof pickedWeekTag === "number" ? (
        <Typography
          component="span"
          variant="overline"
          aria-hidden
          sx={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            px: 0.5,
            lineHeight: 1.2,
            fontSize: "0.55rem",
            letterSpacing: 0.5,
            fontWeight: 700,
            bgcolor: "background.paper",
            color: "text.secondary",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          {`PICKED WK ${pickedWeekTag}`}
        </Typography>
      ) : null}
    </Box>
  );
}
