import { describe, expect, it } from "vitest";

import {
  EMAIL_CIRCUIT_FAILURE_THRESHOLD,
  createEmailCircuitBreaker,
  recordEmailSendFailure,
  recordEmailSendSuccess,
} from "./circuit-breaker";

describe("email circuit breaker", () => {
  it("stays closed below the consecutive-failure threshold", () => {
    const breaker = createEmailCircuitBreaker();

    expect(recordEmailSendFailure(breaker)).toBe(false);
    expect(recordEmailSendFailure(breaker)).toBe(false);
    expect(breaker.open).toBe(false);
    expect(breaker.consecutiveFailures).toBe(2);
  });

  it("opens on the Nth consecutive failure and reports the transition once", () => {
    const breaker = createEmailCircuitBreaker();

    for (let i = 0; i < EMAIL_CIRCUIT_FAILURE_THRESHOLD - 1; i++) {
      expect(recordEmailSendFailure(breaker)).toBe(false);
    }

    expect(recordEmailSendFailure(breaker)).toBe(true);
    expect(breaker.open).toBe(true);
    expect(recordEmailSendFailure(breaker)).toBe(false);
  });

  it("resets consecutive failures after a success", () => {
    const breaker = createEmailCircuitBreaker();

    recordEmailSendFailure(breaker);
    recordEmailSendFailure(breaker);
    recordEmailSendSuccess(breaker);

    expect(breaker.consecutiveFailures).toBe(0);
    expect(breaker.open).toBe(false);

    recordEmailSendFailure(breaker);
    expect(breaker.consecutiveFailures).toBe(1);
    expect(breaker.open).toBe(false);
  });

  it("honors a custom threshold", () => {
    const breaker = createEmailCircuitBreaker(1);

    expect(recordEmailSendFailure(breaker)).toBe(true);
    expect(breaker.open).toBe(true);
  });
});
