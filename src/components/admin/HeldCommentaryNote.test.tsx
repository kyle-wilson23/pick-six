// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { QUIET_WEEK_SENTENCE } from "@/lib/commentary/quiet-week";

import { HeldCommentaryNote } from "./HeldCommentaryNote";

const theme = createTheme({ palette: { mode: "dark" } });

function renderNote(sentences: string[]) {
  return render(
    <ThemeProvider theme={theme}>
      <HeldCommentaryNote sentences={sentences} />
    </ThemeProvider>,
  );
}

describe("HeldCommentaryNote", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists proved lines and the stored quiet sentence", () => {
    renderNote(["Alice took Buffalo for two.", QUIET_WEEK_SENTENCE]);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Alice took Buffalo for two.",
      QUIET_WEEK_SENTENCE,
    ]);
  });

  it("renders nothing for an empty list and does not invent the quiet sentence", () => {
    const { container } = renderNote([]);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(QUIET_WEEK_SENTENCE)).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
