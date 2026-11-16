// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentaryDebugSwitch } from "./CommentaryDebugSwitch";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const theme = createTheme({ palette: { mode: "dark" } });

function renderSwitch(commentaryDebug: boolean) {
  return render(
    <ThemeProvider theme={theme}>
      <CommentaryDebugSwitch leagueId="league-1" commentaryDebug={commentaryDebug} />
    </ThemeProvider>,
  );
}

describe("CommentaryDebugSwitch", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("starts off when the hold has not been changed", () => {
    renderSwitch(false);
    expect(screen.getByRole("switch", { name: "Hold the note" })).toHaveProperty("checked", false);
  });

  it("shows the stored boolean after saving on, then off", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { commentaryDebug: boolean };
      return {
        ok: true,
        json: async () => ({ commentaryDebug: body.commentaryDebug }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Hold the note" });

    fireEvent.click(control);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/leagues/league-1/commentary-debug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryDebug: true }),
      });
    });
    expect(refresh).toHaveBeenCalled();
    expect(control).toHaveProperty("checked", true);

    fireEvent.click(control);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/leagues/league-1/commentary-debug", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryDebug: false }),
      });
    });
    expect(control).toHaveProperty("checked", false);
  });

  it("shows the stored value when the response differs from the toggle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ commentaryDebug: false }),
      })),
    );

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Hold the note" });
    fireEvent.click(control);

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(control).toHaveProperty("checked", false);
  });

  it("reverts and shows the error when the save is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: { message: "Superuser access required" },
        }),
      })),
    );

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Hold the note" });
    fireEvent.click(control);

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Superuser access required",
    );
    expect(control).toHaveProperty("checked", false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
