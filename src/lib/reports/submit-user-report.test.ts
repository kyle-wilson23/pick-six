import { describe, expect, it, vi } from "vitest";

import { submitUserReport, type SubmitUserReportDeps } from "./submit-user-report";

function deps(overrides: Partial<SubmitUserReportDeps> = {}): SubmitUserReportDeps {
  return {
    resolveLeague: vi.fn().mockResolvedValue({ id: "lg-1", name: "Alpha" }),
    loadUser: vi.fn().mockResolvedValue({
      id: "user-1",
      name: "Kyle Wilson",
      email: "kyle@example.com",
    }),
    githubConfigured: () => true,
    operatorConfigured: () => true,
    uploadScreenshot: vi.fn().mockResolvedValue("https://blob.example/shot.png"),
    createIssue: vi.fn().mockResolvedValue(undefined),
    sendOperatorFallback: vi.fn().mockResolvedValue(undefined),
    sendReceipt: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const baseInput = {
  userId: "user-1",
  description: "Standings did not update",
  visitTrail: ["/home", "/leagues/lg-1/standings"],
  currentPathname: "/leagues/lg-1/standings",
  userAgent: "Mozilla/5.0",
  viewportWidth: 1280,
  viewportHeight: 720,
};

describe("submitUserReport", () => {
  it("happy path creates an issue and sends a receipt", async () => {
    const d = deps();
    const result = await submitUserReport(baseInput, d);
    expect(result).toEqual({ ok: true });
    expect(d.createIssue).toHaveBeenCalledOnce();
    expect(d.sendReceipt).toHaveBeenCalledWith({
      to: "kyle@example.com",
      userId: "user-1",
    });
    expect(d.sendOperatorFallback).not.toHaveBeenCalled();
  });

  it("rejects empty description with no I/O", async () => {
    const d = deps();
    const result = await submitUserReport({ ...baseInput, description: "   " }, d);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR", httpStatus: 400 });
    expect(d.createIssue).not.toHaveBeenCalled();
    expect(d.uploadScreenshot).not.toHaveBeenCalled();
    expect(d.sendReceipt).not.toHaveBeenCalled();
  });

  it("F2b: Blob fail still opens the issue and flags screenshotOmitted", async () => {
    const d = deps({
      uploadScreenshot: vi.fn().mockRejectedValue(new Error("blob down")),
    });
    const result = await submitUserReport(
      {
        ...baseInput,
        screenshot: { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" },
      },
      d,
    );
    expect(result).toEqual({ ok: true, screenshotOmitted: true });
    expect(d.createIssue).toHaveBeenCalledOnce();
    const body = (d.createIssue as ReturnType<typeof vi.fn>).mock.calls[0]![0].body as string;
    expect(body).not.toContain("![screenshot]");
  });

  it("F1b: GitHub fail sends operator fallback and still succeeds", async () => {
    const d = deps({
      createIssue: vi.fn().mockRejectedValue(new Error("GitHub 502")),
    });
    const result = await submitUserReport(baseInput, d);
    expect(result).toEqual({ ok: true, githubFallback: true });
    expect(d.sendOperatorFallback).toHaveBeenCalledOnce();
    const fallback = (d.sendOperatorFallback as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as { githubError: string; body: string };
    expect(fallback.githubError).toContain("GitHub 502");
    expect(fallback.body).toContain("Standings did not update");
    expect(d.sendReceipt).toHaveBeenCalledOnce();
  });

  it("total fail when GitHub and operator mail both fail", async () => {
    const d = deps({
      createIssue: vi.fn().mockRejectedValue(new Error("GitHub 502")),
      sendOperatorFallback: vi.fn().mockRejectedValue(new Error("Resend 500")),
    });
    const result = await submitUserReport(baseInput, d);
    expect(result).toMatchObject({ ok: false, code: "DELIVERY_FAILED", httpStatus: 502 });
    expect(d.sendReceipt).not.toHaveBeenCalled();
  });

  it("F3a: receipt fail still returns success after GitHub", async () => {
    const d = deps({
      sendReceipt: vi.fn().mockRejectedValue(new Error("receipt failed")),
    });
    const result = await submitUserReport(baseInput, d);
    expect(result).toEqual({ ok: true });
  });

  it("missing GitHub env with operator mail works as F1b", async () => {
    const d = deps({ githubConfigured: () => false });
    const result = await submitUserReport(baseInput, d);
    expect(result).toEqual({ ok: true, githubFallback: true });
    expect(d.createIssue).not.toHaveBeenCalled();
    expect(d.sendOperatorFallback).toHaveBeenCalledOnce();
  });

  it("CONFIG_ERROR when GitHub and operator are both unconfigured", async () => {
    const d = deps({
      githubConfigured: () => false,
      operatorConfigured: () => false,
    });
    const result = await submitUserReport(baseInput, d);
    expect(result).toMatchObject({ ok: false, code: "CONFIG_ERROR", httpStatus: 500 });
    expect(d.loadUser).not.toHaveBeenCalled();
  });
});
