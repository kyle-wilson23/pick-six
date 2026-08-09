import { createTheme } from "@mui/material/styles";

import type { ColorMode } from "@/lib/color-mode";
import {
  DESKTOP_APP_BAR_OFFSET_PX,
  focusVisibleRingCss,
} from "@/theme/focus-visible-ring";

const darkPalette = {
  mode: "dark" as const,
  primary: {
    main: "#2ECC71",
    light: "#58D68D",
    dark: "#27AE60",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#121212",
    paper: "#1E1E1E",
    elevated: "#2A2A2A",
    overlay: "#333333",
  },
  accent: {
    gold: "#FFD700",
    goldLight: "#FFE44D",
    goldDark: "#E5C100",
  },
};

/** White / near-white surfaces; slightly deeper emerald for contrast on light. */
const lightPalette = {
  mode: "light" as const,
  primary: {
    main: "#1F9D55",
    light: "#2ECC71",
    dark: "#187A42",
    contrastText: "#FFFFFF",
  },
  text: {
    primary: "#1A1A1A",
    secondary: "#5C5C5C",
  },
  divider: "rgba(0, 0, 0, 0.12)",
  background: {
    default: "#FFFFFF",
    paper: "#F7F7F7",
    elevated: "#EEEEEE",
    overlay: "#E0E0E0",
  },
  accent: {
    gold: "#B8860B",
    goldLight: "#D4A017",
    goldDark: "#8B6914",
  },
};

/** UX: Visual Design Foundation — emerald primary, gold accent; dark default, optional light. */
export function createAppTheme(fontFamily: string, mode: ColorMode = "dark") {
  const palette = mode === "light" ? lightPalette : darkPalette;

  return createTheme({
    palette,
    typography: {
      fontFamily,
    },
    shape: {
      borderRadius: 16,
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 768,
        lg: 1200,
        xl: 1536,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            textDecoration: "none",
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
          sizeSmall: {
            minHeight: 48,
          },
          sizeMedium: {
            minHeight: 48,
          },
          sizeLarge: {
            minHeight: 48,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            minHeight: 48,
            textDecoration: "none",
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: ({ theme }) => ({
            textDecoration: "none",
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            textDecoration: "none",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            minWidth: 48,
            minHeight: 48,
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiLink: {
        defaultProps: {
          color: "primary",
          underline: "always",
        },
        styleOverrides: {
          root: ({ theme }) => ({
            "&:hover": {
              color: theme.palette.primary.light,
            },
            "&:focus-visible": focusVisibleRingCss(theme.palette.primary.main),
          }),
        },
      },
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          // Fixed desktop AppBar: keep focus / scrollIntoView / hash targets below the bar.
          html: {
            [theme.breakpoints.up("md")]: {
              scrollPaddingTop: DESKTOP_APP_BAR_OFFSET_PX,
            },
          },
          a: {
            color: theme.palette.primary.main,
            textDecoration: "underline",
            "&:hover": {
              color: theme.palette.primary.light,
            },
          },
        }),
      },
      // Outlined TextField already uses a notched fieldset border on focus.
      // Do not add focusVisibleRingCss here — a second outline cuts through the floating label.
    },
  });
}
