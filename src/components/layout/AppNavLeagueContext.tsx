"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { parseLeagueIdFromPathname } from "@/lib/league/league-nav-tabs";

export type AppNavLeagueState = {
  leagueId: string;
  leagueName: string;
  isTestLeague: boolean;
  isAdmin: boolean;
};

type AppNavLeagueContextValue = {
  league: AppNavLeagueState | null;
  setLeague: (league: AppNavLeagueState | null) => void;
};

const AppNavLeagueContext = createContext<AppNavLeagueContextValue | null>(null);

export function AppNavLeagueRootProvider({ children }: { children: ReactNode }) {
  const [league, setLeague] = useState<AppNavLeagueState | null>(null);
  const value = useMemo(() => ({ league, setLeague }), [league]);

  return <AppNavLeagueContext.Provider value={value}>{children}</AppNavLeagueContext.Provider>;
}

function useAppNavLeagueContext(): AppNavLeagueContextValue {
  const ctx = useContext(AppNavLeagueContext);
  if (ctx == null) {
    throw new Error("AppNavLeagueRootProvider is missing from the app layout");
  }
  return ctx;
}

export function useAppNavLeague(): AppNavLeagueState | null {
  return useAppNavLeagueContext().league;
}

/** Clears stale league nav context as soon as the URL leaves `/leagues/[leagueId]`. */
export function useClearAppNavLeagueWhenOutsideLeagueRoute() {
  const pathname = usePathname();
  const { setLeague } = useAppNavLeagueContext();

  useLayoutEffect(() => {
    if (parseLeagueIdFromPathname(pathname) === null) {
      setLeague(null);
    }
  }, [pathname, setLeague]);
}

type SyncAppNavLeagueProps = {
  value: AppNavLeagueState;
  children: ReactNode;
};

/** Registers league nav context for routes under `/leagues/[leagueId]/**`. */
export function SyncAppNavLeague({ value, children }: SyncAppNavLeagueProps) {
  const { setLeague } = useAppNavLeagueContext();

  useLayoutEffect(() => {
    setLeague(value);
    return () => setLeague(null);
  }, [value.leagueId, value.leagueName, value.isTestLeague, value.isAdmin, setLeague]);

  return <>{children}</>;
}
