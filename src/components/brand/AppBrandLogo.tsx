"use client";

import Typography from "@mui/material/Typography";
import Link from "next/link";

export const APP_BRAND_MARK = "PIGSKIN PICK'EM";

type AppBrandLogoProps = {
  size?: "nav" | "auth";
  /** When set, wraps the mark in a Next.js link (e.g. `/home` in the nav). */
  href?: string;
};

const markSx = {
  color: "primary.main",
  fontWeight: 800,
  letterSpacing: 1,
  textDecoration: "none",
  flexShrink: 0,
} as const;

/**
 * Shared text brand mark. Nav uses h6; auth screens use a slightly larger h5.
 */
export function AppBrandLogo({ size = "nav", href }: AppBrandLogoProps) {
  const variant = size === "auth" ? "h5" : "h6";

  if (href) {
    return (
      <Typography component={Link} href={href} variant={variant} sx={markSx}>
        {APP_BRAND_MARK}
      </Typography>
    );
  }

  return (
    <Typography component="span" variant={variant} sx={markSx}>
      {APP_BRAND_MARK}
    </Typography>
  );
}
