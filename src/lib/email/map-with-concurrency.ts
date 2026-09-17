/**
 * Bounded-concurrency pool for independent async work (Story 7.4 email sends).
 * No external dependency — simple worker-pool over an array.
 *
 * `minIntervalMs` serializes **start** slots across workers in this call so
 * fan-out cannot burst `emails.send` faster than the provider's per-second cap.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options?: { shouldAbort?: () => boolean; minIntervalMs?: number },
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const minIntervalMs = options?.minIntervalMs;
  let nextAllowedStart = 0;
  let startGate: Promise<void> = Promise.resolve();

  async function waitForStartSlot(): Promise<void> {
    if (minIntervalMs == null || minIntervalMs <= 0) {
      return;
    }

    let release!: () => void;
    const previous = startGate;
    startGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const scheduledStart = Math.max(Date.now(), nextAllowedStart);
    nextAllowedStart = scheduledStart + minIntervalMs;
    release();
    const waitMs = scheduledStart - Date.now();
    if (waitMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      if (options?.shouldAbort?.()) {
        return;
      }
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      await waitForStartSlot();
      if (options?.shouldAbort?.()) {
        return;
      }
      results[index] = await mapper(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/** Default pool size for multi-member Resend loops (~MVP league size). */
export const EMAIL_SEND_CONCURRENCY = 4;

/** Min gap between `emails.send` starts in one fan-out (8 starts/s under Resend's 10/s cap). */
export const EMAIL_SEND_MIN_INTERVAL_MS = 125;
