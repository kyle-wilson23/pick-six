"use client";

import Button from "@mui/material/Button";
import Link from "next/link";

export function CreateLeagueLinkButton() {
  return (
    <Button variant="contained" color="primary" component={Link} href="/leagues/new">
      Create a league
    </Button>
  );
}
