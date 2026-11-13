// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentarySwitch } from "./CommentarySwitch";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const theme = createTheme({ palette: { mode: "dark" } });

function renderSwitch(commentaryEnabled: boolean) {
  return render(
    <ThemeProvider theme={theme}>
      <CommentarySwitch leagueId="league-1" commentaryEnabled={commentaryEnabled} />
    </ThemeProvider>,
  );
}

describe("CommentarySwitch", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("starts checked when commentary is already on", () => {
    renderSwitch(true);
    expect(screen.getByRole("switch", { name: "Weekly commentary" })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("saves on, then off", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { commentaryEnabled: boolean };
      return {
        ok: true,
        json: async () => ({ commentaryEnabled: body.commentaryEnabled }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Weekly commentary" });
    expect(control).toHaveProperty("checked", false);

    fireEvent.click(control);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/leagues/league-1/commentary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryEnabled: true }),
      });
    });
    expect(refresh).toHaveBeenCalled();
    expect(control).toHaveProperty("checked", true);

    fireEvent.click(control);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/leagues/league-1/commentary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentaryEnabled: false }),
      });
    });
    expect(control).toHaveProperty("checked", false);
  });

  it("reverts and shows the error when the save is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: { message: "Admin access required for this league" },
        }),
      })),
    );

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Weekly commentary" });
    fireEvent.click(control);

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Admin access required for this league",
    );
    expect(control).toHaveProperty("checked", false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reverts and shows Request failed when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    renderSwitch(false);
    const control = screen.getByRole("switch", { name: "Weekly commentary" });
    fireEvent.click(control);

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Request failed");
    expect(control).toHaveProperty("checked", false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
