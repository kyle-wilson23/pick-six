import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    accent: {
      gold: string;
      goldLight: string;
      goldDark: string;
    };
  }
  interface PaletteOptions {
    accent?: Partial<Palette["accent"]>;
  }
}
