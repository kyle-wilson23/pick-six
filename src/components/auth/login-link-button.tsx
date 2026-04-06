"use client";

import Button from "@mui/material/Button";
import Link from "next/link";

export function LoginLinkButton() {
  return (
    <Button variant="contained" color="primary" size="large" component={Link} href="/login">
      Login
    </Button>
  );
}
