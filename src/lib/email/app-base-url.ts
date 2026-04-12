/**
 * Absolute app origin for server-built links (Auth.js env + dev default).
 * Matches `prisma/seed.cjs` resolution order.
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
