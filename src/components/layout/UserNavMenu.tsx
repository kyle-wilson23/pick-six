"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { signOut } from "next-auth/react";
import { useId, useState } from "react";

type UserNavMenuProps = {
  userDisplayName: string;
};

function userInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function UserNavMenu({ userDisplayName }: UserNavMenuProps) {
  const menuId = useId();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = anchorEl != null;

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : undefined}
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        sx={{
          borderRadius: 2,
          px: 1.25,
          py: 0.5,
          maxWidth: 320,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: "primary.dark",
              fontSize: "0.875rem",
              flexShrink: 0,
            }}
          >
            {userInitials(userDisplayName)}
          </Avatar>
          <Typography
            variant="body2"
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              maxWidth: 240,
              color: "text.primary",
              textAlign: "left",
            }}
          >
            {userDisplayName}
          </Typography>
          <ExpandMoreIcon
            fontSize="small"
            aria-hidden
            sx={{
              flexShrink: 0,
              color: "text.secondary",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </Stack>
      </IconButton>

      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: anchorEl?.offsetWidth ?? undefined,
            },
          },
        }}
      >
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
