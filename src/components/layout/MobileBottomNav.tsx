"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HistoryIcon from "@mui/icons-material/History";
import HomeIcon from "@mui/icons-material/Home";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import LogoutIcon from "@mui/icons-material/Logout";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import Box from "@mui/material/Box";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useId, useState, type ReactElement } from "react";

import {
  buildLeagueTabHref,
  getMobileBottomNavTabs,
  getMobileMoreMenuTabs,
  type LeagueNavTab,
} from "@/lib/league/league-nav-tabs";

const TAB_ICONS: Record<string, ReactElement> = {
  home: <HomeIcon />,
  picks: <SportsFootballIcon />,
  standings: <LeaderboardIcon />,
  history: <HistoryIcon />,
  results: <EmojiEventsIcon />,
  rules: <MenuBookIcon />,
  admin: <AdminPanelSettingsIcon />,
  invites: <MailOutlineIcon />,
  settings: <SettingsIcon />,
};

type MobileBottomNavProps = {
  homeActive: boolean;
  leagueId: string | null;
  leagueActiveTab: string | false;
  isAdmin: boolean;
};

export function MobileBottomNav({
  homeActive,
  leagueId,
  leagueActiveTab,
  isAdmin,
}: MobileBottomNavProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const menuId = useId();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = menuAnchor != null;

  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");
  const leagueTabs = leagueId != null ? getMobileBottomNavTabs(isAdmin) : [];
  const moreMenuTabs = leagueId != null ? getMobileMoreMenuTabs(isAdmin) : [];
  const moreMenuActive =
    profileActive ||
    (typeof leagueActiveTab === "string" &&
      moreMenuTabs.some((tab) => tab.key === leagueActiveTab));
  const navValue = homeActive ? "home" : moreMenuActive ? "more" : leagueActiveTab;

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleLogout = () => {
    handleCloseMenu();
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <Box
      component="nav"
      aria-label="App"
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        width: "100%",
        maxWidth: "100vw",
        bgcolor: "background.paper",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <BottomNavigation
        value={navValue}
        onChange={() => {}}
        showLabels
        sx={{
          height: 56,
          pb: "env(safe-area-inset-bottom, 0px)",
          bgcolor: "background.paper",
          "& .MuiBottomNavigationAction-root": {
            minWidth: 56,
            maxWidth: 96,
            px: 0.5,
          },
          "& .Mui-selected": {
            color: "primary.main",
          },
        }}
      >
        <BottomNavigationAction
          label="Home"
          value="home"
          icon={TAB_ICONS.home}
          component={Link}
          href="/home"
          aria-current={homeActive ? "page" : undefined}
        />
        {leagueId != null
          ? leagueTabs.map((tab: LeagueNavTab) => {
              const isActive = leagueActiveTab === tab.key;
              return (
                <BottomNavigationAction
                  key={tab.key}
                  label={tab.label}
                  value={tab.key}
                  icon={TAB_ICONS[tab.key]}
                  component={Link}
                  href={buildLeagueTabHref(leagueId, tab.hrefSuffix)}
                  aria-current={isActive ? "page" : undefined}
                />
              );
            })
          : null}
        <BottomNavigationAction
          label="More"
          value="more"
          icon={<MoreHorizIcon />}
          onClick={handleOpenMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen ? "true" : undefined}
          aria-controls={menuOpen ? menuId : undefined}
          aria-current={moreMenuActive ? "page" : undefined}
        />
      </BottomNavigation>

      <Menu
        id={menuId}
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { minWidth: 200 },
          },
          list: {
            "aria-label": "More options",
          },
        }}
      >
        {leagueId != null
          ? moreMenuTabs.map((tab) => (
              <MenuItem
                key={tab.key}
                component={Link}
                href={buildLeagueTabHref(leagueId, tab.hrefSuffix)}
                onClick={handleCloseMenu}
                selected={leagueActiveTab === tab.key}
              >
                <ListItemIcon sx={{ minWidth: 36, "& .MuiSvgIcon-root": { fontSize: 20 } }}>
                  {TAB_ICONS[tab.key]}
                </ListItemIcon>
                <ListItemText>{tab.label}</ListItemText>
              </MenuItem>
            ))
          : null}
        <MenuItem
          component={Link}
          href="/profile"
          onClick={handleCloseMenu}
          selected={profileActive}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
