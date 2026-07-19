/**
 * Bounded-concurrency pool for independent async work (Story 7.4 email sends).
 * No external dependency — simple worker-pool over an array.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  options?: { shouldAbort?: () => boolean },
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

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
      results[index] = await mapper(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/** Default pool size for multi-member Resend loops (~MVP league size). */
export const EMAIL_SEND_CONCURRENCY = 4;
