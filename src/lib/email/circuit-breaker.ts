/**
 * Consecutive-failure circuit breaker for Resend send loops (Story 7.4).
 * After {@link EMAIL_CIRCUIT_FAILURE_THRESHOLD} consecutive provider failures,
 * remaining recipients in that invocation should abort.
 */

export const EMAIL_CIRCUIT_FAILURE_THRESHOLD = 3;

export const EMAIL_CIRCUIT_OPEN_CODE = "EMAIL_CIRCUIT_OPEN" as const;

export type EmailCircuitBreaker = {
  consecutiveFailures: number;
  open: boolean;
};

export function createEmailCircuitBreaker(
  threshold: number = EMAIL_CIRCUIT_FAILURE_THRESHOLD,
): EmailCircuitBreaker & { threshold: number } {
  return {
    consecutiveFailures: 0,
    open: false,
    threshold,
  };
}

export function recordEmailSendSuccess(
  breaker: EmailCircuitBreaker,
): void {
  if (breaker.open) {
    return;
  }
  breaker.consecutiveFailures = 0;
}

/**
 * Records a provider failure. Returns `true` when this call **opens** the circuit
 * (transition from closed → open).
 */
export function recordEmailSendFailure(
  breaker: EmailCircuitBreaker & { threshold?: number },
): boolean {
  if (breaker.open) {
    return false;
  }
  const threshold = breaker.threshold ?? EMAIL_CIRCUIT_FAILURE_THRESHOLD;
  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= threshold) {
    breaker.open = true;
    return true;
  }
  return false;
}
