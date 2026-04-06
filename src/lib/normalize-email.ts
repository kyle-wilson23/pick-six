/** Lowercase + trim — use before credential lookup and when persisting email (Story 1.3). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
