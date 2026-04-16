"use client";

import Button from "@mui/material/Button";
import Link from "next/link";

export function MyLeaguesLinkButton() {
  return (
    <Button variant="outlined" color="primary" component={Link} href="/my-leagues">
      Your leagues
    </Button>
  );
}
