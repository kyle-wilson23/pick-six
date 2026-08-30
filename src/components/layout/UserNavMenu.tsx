"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useId, useState } from "react";

import { UserAvatar } from "@/components/user/UserAvatar";

type UserNavMenuProps = {
  userDisplayName: string;
  userImageUrl?: string | null;
  onReportProblem: () => void;
};

export function UserNavMenu({
  userDisplayName,
  userImageUrl = null,
  onReportProblem,
}: UserNavMenuProps) {
  const menuId = useId();
  const { data: session, status } = useSession();
  // Optimistic: non-empty session URL after Profile `update()`. Otherwise trust the
  // layout prop (DB-backed). Do not let a stale JWT `image: null` hide a real photo.
  const sessionImage =
    status === "authenticated" && typeof session?.user?.image === "string"
      ? session.user.image.trim()
      : "";
  const propImage = userImageUrl?.trim() || "";
  const resolvedImageUrl = sessionImage || propImage || null;
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
          <UserAvatar
            displayName={userDisplayName}
            imageUrl={resolvedImageUrl}
            size="nav"
          />
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
        <MenuItem component={Link} href="/profile" onClick={handleClose}>
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onReportProblem();
          }}
        >
          <ListItemIcon>
            <ReportProblemOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Report a problem</ListItemText>
        </MenuItem>
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
