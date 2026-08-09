"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { SessionProvider } from "next-auth/react";
import { useMemo } from "react";

import { ColorModeProvider, useColorMode } from "@/components/color-mode/color-mode-context";
import { SyncColorModeCookie } from "@/components/color-mode/sync-color-mode-cookie";
import type { ColorMode } from "@/lib/color-mode";
import { createAppTheme } from "@/theme/create-app-theme";

function ThemedApp({
  children,
  fontFamily,
}: {
  children: React.ReactNode;
  fontFamily: string;
}) {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(fontFamily, mode), [fontFamily, mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({
  children,
  fontFamily,
  initialColorMode,
}: {
  children: React.ReactNode;
  fontFamily: string;
  initialColorMode: ColorMode;
}) {
  return (
    <SessionProvider>
      <AppRouterCacheProvider>
        <ColorModeProvider initialMode={initialColorMode}>
          <SyncColorModeCookie mode={initialColorMode} />
          <ThemedApp fontFamily={fontFamily}>{children}</ThemedApp>
        </ColorModeProvider>
      </AppRouterCacheProvider>
    </SessionProvider>
  );
}
