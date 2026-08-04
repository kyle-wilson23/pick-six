"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HistoryIcon from "@mui/icons-material/History";
import HomeIcon from "@mui/icons-material/Home";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Portal from "@mui/material/Portal";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { SkipLink } from "@/components/a11y/SkipLink";
import { AppBrandLogo } from "@/components/brand/AppBrandLogo";
import {
  useAppNavLeague,
  useClearAppNavLeagueWhenOutsideLeagueRoute,
} from "@/components/layout/AppNavLeagueContext";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { NavigationLoadingIndicator } from "@/components/layout/NavigationLoadingIndicator";
import { ScrollToTopOnNavigate } from "@/components/layout/ScrollToTopOnNavigate";
import { UserNavMenu } from "@/components/layout/UserNavMenu";
import { TestLeagueChip } from "@/components/league/TestLeagueChip";
import {
  buildLeagueTabHref,
  getActiveLeagueTab,
  getLeagueNavTabs,
  isHomePath,
  resolveAppNavLeagueId,
  type LeagueNavTab,
} from "@/lib/league/league-nav-tabs";

type LeagueNavShellProps = {
  userDisplayName: string;
  children: ReactNode;
};

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

function renderDesktopTab(
  tab: LeagueNavTab | { key: string; label: string; href: string },
  activeTab: string | false,
) {
  const isActive = activeTab === tab.key;
  const href = "href" in tab ? tab.href : tab.hrefSuffix;
  return (
    <Tab
      key={tab.key}
      label={tab.label}
      value={tab.key}
      component={Link}
      href={href}
      aria-current={isActive ? "page" : undefined}
    />
  );
}

export function LeagueNavShell({ userDisplayName, children }: LeagueNavShellProps) {
  const theme = useTheme();
  const pathname = usePathname();
  useClearAppNavLeagueWhenOutsideLeagueRoute();
  const league = useAppNavLeague();

  const leagueId = resolveAppNavLeagueId(pathname);
  const leagueName = league?.leagueName ?? "";
  const isTestLeague = league?.isTestLeague ?? false;
  // Pathname can resolve admin/invites/settings before SyncAppNavLeague repopulates context.
  // Only trust the path when context is still null — never override an explicit false.
  const pathLeagueTab =
    leagueId != null ? getActiveLeagueTab(pathname, leagueId) : null;
  const isAdmin =
    league?.isAdmin === true ||
    (league == null &&
      (pathLeagueTab === "admin" ||
        pathLeagueTab === "invites" ||
        pathLeagueTab === "settings"));

  const homeActive = isHomePath(pathname);
  // Invites (like admin/settings) is admin-only in nav; the page itself can still be
  // membership-visible — don't mark those tabs active for non-admins.
  const isAdminOnlyNavTab =
    pathLeagueTab === "admin" ||
    pathLeagueTab === "invites" ||
    pathLeagueTab === "settings";
  const leagueActiveTab =
    pathLeagueTab != null && (isAdmin || !isAdminOnlyNavTab) ? pathLeagueTab : false;
  const activeTab = homeActive ? "home" : leagueActiveTab;

  const leagueTabs = leagueId != null ? getLeagueNavTabs(isAdmin) : [];
  const renderedTabKeys = new Set(["home", ...leagueTabs.map((tab) => tab.key)]);
  const tabsValue =
    typeof activeTab === "string" && renderedTabKeys.has(activeTab) ? activeTab : false;

  const homeTab = {
    key: "home",
    label: "Home",
    href: "/home",
  };

  return (
    <>
      <ScrollToTopOnNavigate />
      <SkipLink />
      <Stack
        sx={{
          minHeight: "100vh",
          overflowAnchor: "none",
          overflowX: "hidden",
          width: "100%",
          maxWidth: "100vw",
        }}
      >
        <AppBar
          position="fixed"
          color="default"
          elevation={0}
          sx={{
            display: { xs: "none", md: "flex" },
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Toolbar sx={{ gap: 2, minHeight: { md: 64 } }}>
            <AppBrandLogo size="nav" href="/home" />

            {leagueId != null ? (
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
            ) : null}

            <Box component="nav" aria-label="App" sx={{ flex: 1, minWidth: 0, display: "flex" }}>
              <Tabs
                value={tabsValue}
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
                {renderDesktopTab(homeTab, tabsValue)}
                {leagueId != null
                  ? leagueTabs.map((tab) =>
                      renderDesktopTab(
                        {
                          ...tab,
                          href: buildLeagueTabHref(leagueId, tab.hrefSuffix),
                        },
                        tabsValue,
                      ),
                    )
                  : null}
              </Tabs>
            </Box>

            <UserNavMenu userDisplayName={userDisplayName} />
          </Toolbar>
        </AppBar>

        {/* Reserve top space for fixed desktop AppBar (CSS-gated; no useMediaQuery flash). */}
        <Toolbar sx={{ display: { xs: "none", md: "flex" }, minHeight: { md: 64 } }} />

        {leagueId != null && isTestLeague ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{
              display: { xs: "flex", md: "none" },
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
            position: "relative",
            flex: 1,
            pb: {
              xs: "calc(56px + env(safe-area-inset-bottom, 0px))",
              md: 0,
            },
          }}
        >
          <NavigationLoadingIndicator />
          {children}
        </Box>
      </Stack>
      <Portal>
        <MobileBottomNav
          homeActive={homeActive}
          leagueId={leagueId}
          leagueActiveTab={leagueActiveTab}
          isAdmin={isAdmin}
        />
      </Portal>
    </>
  );
}
