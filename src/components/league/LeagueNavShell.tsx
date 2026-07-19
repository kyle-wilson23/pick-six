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

import { SkipLink } from "@/components/a11y/SkipLink";
import { TestLeagueChip } from "@/components/league/TestLeagueChip";
import {
  buildLeagueTabHref,
  getActiveLeagueTab,
  getLeagueNavTabs,
  type LeagueNavTab,
} from "@/lib/league/league-nav-tabs";

type LeagueNavShellProps = {
  leagueId: string;
  leagueName: string;
  isTestLeague?: boolean;
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

function renderDesktopTab(
  tab: LeagueNavTab,
  leagueId: string,
  activeTab: string | false,
) {
  const isActive = activeTab === tab.key;
  return (
    <Tab
      key={tab.key}
      label={tab.label}
      value={tab.key}
      component={Link}
      href={buildLeagueTabHref(leagueId, tab.hrefSuffix)}
      aria-current={isActive ? "page" : undefined}
    />
  );
}

export function LeagueNavShell({
  leagueId,
  leagueName,
  isTestLeague = false,
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
    <>
      <SkipLink />
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

              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ flexShrink: 0, maxWidth: 220, display: { xs: "none", md: "flex" } }}
              >
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                  {leagueName}
                </Typography>
                {isTestLeague ? <TestLeagueChip /> : null}
              </Stack>

              <Box
                component="nav"
                aria-label="League"
                sx={{ flex: 1, minWidth: 0, display: "flex" }}
              >
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
                  {tabs.map((tab) => renderDesktopTab(tab, leagueId, activeTab))}
                </Tabs>
              </Box>

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

        {!isDesktop && isTestLeague ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: theme.zIndex.appBar,
              px: 1.5,
              py: 0.5,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
              {leagueName}
            </Typography>
            <TestLeagueChip />
          </Stack>
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
          <Box
            component="nav"
            aria-label="League"
            sx={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: theme.zIndex.appBar,
            }}
          >
            <BottomNavigation
              value={activeTab}
              onChange={() => {}}
              showLabels
              sx={{
                height: 56,
                pb: "env(safe-area-inset-bottom, 0px)",
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                "& .MuiBottomNavigationAction-root": {
                  minWidth: 0,
                  px: 0.5,
                },
                "& .Mui-selected": {
                  color: "primary.main",
                },
              }}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
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
              })}
            </BottomNavigation>
          </Box>
        ) : null}
      </Stack>
    </>
  );
}
