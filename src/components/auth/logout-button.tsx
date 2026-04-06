"use client";

import Button from "@mui/material/Button";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <Button variant="outlined" color="inherit" onClick={() => signOut({ callbackUrl: "/" })}>
      Logout
    </Button>
  );
}
