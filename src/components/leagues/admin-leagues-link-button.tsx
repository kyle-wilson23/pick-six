"use client";

import Button from "@mui/material/Button";
import Link from "next/link";

export function AdminLeaguesLinkButton() {
  return (
    <Button variant="outlined" color="secondary" component={Link} href="/leagues">
      Leagues you administer
    </Button>
  );
}
