import { createTheme } from "@mui/material/styles";

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
          root: {
            textTransform: "none",
          },
        },
      },
    },
  });
}
