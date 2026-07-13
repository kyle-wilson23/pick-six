"use client";

import Link from "@mui/material/Link";

/**
 * First focusable control on shell / login pages — visually hidden until focused.
 * Target: `#main-content` on the page `<main>`.
 */
export function SkipLink() {
  return (
    <Link
      href="#main-content"
      underline="none"
      onClick={(event) => {
        const target = document.getElementById("main-content");
        if (!target) return;
        event.preventDefault();
        target.focus();
        if (window.location.hash !== "#main-content") {
          window.history.replaceState(null, "", "#main-content");
        }
      }}
      sx={{
        position: "absolute",
        left: -9999,
        top: 8,
        zIndex: (t) => t.zIndex.tooltip + 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: "background.paper",
        color: "primary.main",
        fontWeight: 700,
        outline: "2px solid",
        outlineColor: "primary.main",
        outlineOffset: 2,
        "&:focus": {
          left: 8,
        },
      }}
    >
      Skip to main content
    </Link>
  );
}
