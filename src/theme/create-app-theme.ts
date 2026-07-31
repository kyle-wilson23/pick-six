import { createTheme } from "@mui/material/styles";

import {
  DESKTOP_APP_BAR_OFFSET_PX,
  focusVisibleRingCss,
} from "@/theme/focus-visible-ring";

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
