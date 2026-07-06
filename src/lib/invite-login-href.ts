/** Post-login return path for accepting a league invitation. */
export function buildInviteLoginHref(token: string): string {
  return `/login?callbackUrl=${encodeURIComponent(`/signup/${token}`)}`;
}
