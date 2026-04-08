"use client";

import Button from "@mui/material/Button";
import Link from "next/link";

export function DashboardLinkButton() {
  return (
    <Button variant="outlined" size="large" component={Link} href="/dashboard">
      Dashboard
    </Button>
  );
}
