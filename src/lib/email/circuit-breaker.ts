/**
 * Consecutive-failure circuit breaker for Resend send loops (Story 7.4).
 * After {@link EMAIL_CIRCUIT_FAILURE_THRESHOLD} consecutive provider failures,
 * remaining recipients in that invocation should abort.
 *
 * Callers that process multiple leagues in one cron invocation must create a
 * single breaker and pass it into every per-league send call so the "remaining
 * members/leagues for that invocation" abort behavior spans the whole run, not
 * just the current league.
 */

export const EMAIL_CIRCUIT_FAILURE_THRESHOLD = 3;

export const EMAIL_CIRCUIT_OPEN_CODE = "EMAIL_CIRCUIT_OPEN" as const;

export type EmailCircuitBreaker = {
  consecutiveFailures: number;
  open: boolean;
  threshold: number;
};

export function createEmailCircuitBreaker(
  threshold: number = EMAIL_CIRCUIT_FAILURE_THRESHOLD,
): EmailCircuitBreaker {
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
  breaker: EmailCircuitBreaker,
): boolean {
  if (breaker.open) {
    return false;
  }
  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= breaker.threshold) {
    breaker.open = true;
    return true;
  }
  return false;
}
