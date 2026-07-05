import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypeBackground {
    elevated?: string;
    overlay?: string;
  }
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
