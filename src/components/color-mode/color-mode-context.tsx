"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  applyColorModeToDocument,
  type ColorMode,
  writeColorModeCookie,
} from "@/lib/color-mode";

type ColorModeContextValue = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({
  initialMode,
  children,
}: {
  initialMode: ColorMode;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ColorMode>(initialMode);

  useEffect(() => {
    setModeState(initialMode);
    applyColorModeToDocument(initialMode);
  }, [initialMode]);

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next);
    writeColorModeCookie(next);
    applyColorModeToDocument(next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    throw new Error("useColorMode must be used within ColorModeProvider");
  }
  return ctx;
}
