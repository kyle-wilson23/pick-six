"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { useId } from "react";

import { useColorMode } from "@/components/color-mode/color-mode-context";

type ColorModeToggleProps = {
  /** When set, called after local mode + cookie update (e.g. persist to API). */
  onModeChange?: (mode: "dark" | "light") => void | Promise<void>;
  disabled?: boolean;
};

export function ColorModeToggle({ onModeChange, disabled }: ColorModeToggleProps) {
  const { mode, setMode } = useColorMode();
  const labelId = useId();
  const isLight = mode === "light";

  return (
    <FormControlLabel
      control={
        <Switch
          checked={isLight}
          disabled={disabled}
          inputProps={{ "aria-labelledby": labelId }}
          onChange={(_, checked) => {
            const next = checked ? "light" : "dark";
            setMode(next);
            void onModeChange?.(next);
          }}
        />
      }
      label="Light mode"
      slotProps={{ typography: { id: labelId, variant: "body2" } }}
    />
  );
}
