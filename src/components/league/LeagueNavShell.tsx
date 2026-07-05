"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HistoryIcon from "@mui/icons-material/History";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import {
  buildLeagueTabHref,
  getActiveLeagueTab,
  getLeagueNavTabs,
  type LeagueNavTab,
} from "@/lib/league/league-nav-tabs";

type LeagueNavShellProps = {
  leagueId: string;
  leagueName: string;
  isAdmin: boolean;
  userDisplayName: string;
  children: ReactNode;
};

const TAB_ICONS: Record<string, ReactElement> = {
  picks: <SportsFootballIcon />,
  standings: <LeaderboardIcon />,
  history: <HistoryIcon />,
  results: <EmojiEventsIcon />,
  rules: <MenuBookIcon />,
  admin: <AdminPanelSettingsIcon />,
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

function renderTab(tab: LeagueNavTab, leagueId: string) {
  return (
    <Tab
      key={tab.key}
      label={tab.label}
      value={tab.key}
      component={Link}
      href={buildLeagueTabHref(leagueId, tab.hrefSuffix)}
    />
  );
}

export function LeagueNavShell({
  leagueId,
  leagueName,
  isAdmin,
  userDisplayName,
  children,
}: LeagueNavShellProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const pathname = usePathname();
  const tabs = getLeagueNavTabs(isAdmin);
  const activeTab = getActiveLeagueTab(pathname, leagueId) ?? false;

  return (
    <Stack sx={{ minHeight: "100vh" }}>
      {isDesktop ? (
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Toolbar sx={{ gap: 2, minHeight: { md: 64 } }}>
            <Typography
              component={Link}
              href={`/leagues/${leagueId}`}
              variant="h6"
              sx={{
                color: "primary.main",
                fontWeight: 800,
                letterSpacing: 1,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              PICK SIX
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ flexShrink: 0, maxWidth: 160, display: { xs: "none", md: "block" } }}
            >
              {leagueName}
            </Typography>

            <Tabs
              value={activeTab}
              onChange={() => {}}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                flex: 1,
                minWidth: 0,
                "& .MuiTab-root": {
                  minHeight: 48,
                  textTransform: "none",
                  fontWeight: 600,
                },
                "& .Mui-selected": {
                  color: "primary.main",
                },
                "& .MuiTabs-indicator": {
                  height: 2,
                  bgcolor: "primary.main",
                },
              }}
            >
              {tabs.map((tab) => renderTab(tab, leagueId))}
            </Tabs>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: "primary.dark",
                  fontSize: "0.875rem",
                }}
              >
                {userInitials(userDisplayName)}
              </Avatar>
              <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
                {userDisplayName}
              </Typography>
            </Stack>
          </Toolbar>
        </AppBar>
      ) : null}

      <Box
        sx={{
          flex: 1,
          pb: isDesktop
            ? 0
            : "calc(56px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </Box>

      {!isDesktop ? (
        <BottomNavigation
          value={activeTab}
          onChange={() => {}}
          showLabels
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            pb: "env(safe-area-inset-bottom, 0px)",
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            zIndex: theme.zIndex.appBar,
            "& .MuiBottomNavigationAction-root": {
              minWidth: 0,
              px: 0.5,
            },
            "& .Mui-selected": {
              color: "primary.main",
            },
          }}
        >
          {tabs.map((tab) => (
            <BottomNavigationAction
              key={tab.key}
              label={tab.label}
              value={tab.key}
              icon={TAB_ICONS[tab.key]}
              component={Link}
              href={buildLeagueTabHref(leagueId, tab.hrefSuffix)}
            />
          ))}
        </BottomNavigation>
      ) : null}
    </Stack>
  );
}
