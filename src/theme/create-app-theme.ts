import { createTheme } from "@mui/material/styles";

import { focusVisibleRingCss } from "@/theme/focus-visible-ring";

/** UX: Visual Design Foundation — dark mode, emerald primary, gold accent (Pick Six). */
export function createAppTheme(fontFamily: string) {
  return createTheme({
    palette: {
      mode: "dark",
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
    },
    typography: {
      fontFamily,
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: "none",
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
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
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-focusVisible, &:focus-visible": focusVisibleRingCss(
              theme.palette.primary.main,
            ),
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
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
        styleOverrides: {
          root: ({ theme }) => ({
            "&:focus-visible": focusVisibleRingCss(theme.palette.primary.main),
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-focused": focusVisibleRingCss(theme.palette.primary.main),
          }),
        },
      },
    },
  });
}
