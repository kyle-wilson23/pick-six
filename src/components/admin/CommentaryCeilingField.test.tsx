// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentaryCeilingField } from "./CommentaryCeilingField";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const theme = createTheme({ palette: { mode: "dark" } });

function renderField(ceilingUsd: string) {
  return render(
    <ThemeProvider theme={theme}>
      <CommentaryCeilingField leagueId="league-1" ceilingUsd={ceilingUsd} />
    </ThemeProvider>,
  );
}

describe("CommentaryCeilingField", () => {
  afterEach(() => {
    cleanup();
    refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows the stored decimal", () => {
    renderField("2.5");
    expect(screen.getByRole("textbox", { name: "Weekly dollar ceiling" })).toHaveProperty(
      "value",
      "2.5",
    );
  });

  it("does not save a partial amount until the button is clicked, then shows the stored value", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { commentaryWeeklyCeilingUsd: string };
      return {
        ok: true,
        json: async () => ({ commentaryWeeklyCeilingUsd: body.commentaryWeeklyCeilingUsd }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderField("1");
    const field = screen.getByRole("textbox", { name: "Weekly dollar ceiling" });
    fireEvent.change(field, { target: { value: "2" } });
    fireEvent.change(field, { target: { value: "2.5" } });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save ceiling" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/leagues/league-1/commentary-ceiling", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentaryWeeklyCeilingUsd: "2.5" }),
    });
    expect(refresh).toHaveBeenCalled();
    expect(field).toHaveProperty("value", "2.5");
  });

  it("shows the stored decimal returned by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ commentaryWeeklyCeilingUsd: "2.5" }),
      })),
    );

    renderField("1");
    const field = screen.getByRole("textbox", { name: "Weekly dollar ceiling" });
    fireEvent.change(field, { target: { value: "2.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save ceiling" }));

    await waitFor(() => {
      expect(field).toHaveProperty("value", "2.5");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an alert and leaves the draft when the save is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: { message: "Invalid weekly dollar ceiling" },
        }),
      })),
    );

    renderField("1");
    const field = screen.getByRole("textbox", { name: "Weekly dollar ceiling" });
    fireEvent.change(field, { target: { value: "$1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save ceiling" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Invalid weekly dollar ceiling",
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(field).toHaveProperty("value", "$1");
  });
});
