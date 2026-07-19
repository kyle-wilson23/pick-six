import { describe, expect, it } from "vitest";

import { cronJobHttpStatus } from "./cron-job-http-status";

describe("cronJobHttpStatus", () => {
  it("returns 200 when failed is 0", () => {
    expect(cronJobHttpStatus(0)).toBe(200);
  });

  it("returns 500 when failed is greater than 0", () => {
    expect(cronJobHttpStatus(1)).toBe(500);
    expect(cronJobHttpStatus(12)).toBe(500);
  });
});
