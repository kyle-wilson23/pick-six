/** Profile picture helpers — initials, mime/size limits for avatar uploads. */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarAllowedMime = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

const ALLOWED_MIME_SET = new Set<string>(AVATAR_ALLOWED_MIME_TYPES);

export const AVATAR_TOO_LARGE_MESSAGE = "Image must be 5MB or smaller.";
export const AVATAR_EMPTY_MESSAGE = "Image file is empty.";
export const AVATAR_BAD_TYPE_MESSAGE =
  "Use a JPEG, PNG, or WebP image.";

/**
 * Initials for avatar fallback — same rules as the former nav menu helper:
 * two-word names → first letter of each; otherwise first two characters.
 */
export function userInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function isAllowedAvatarMime(mime: string): mime is AvatarAllowedMime {
  return ALLOWED_MIME_SET.has(mime);
}

export type AvatarFileValidation =
  | { ok: true; mime: AvatarAllowedMime }
  | { ok: false; code: "TOO_LARGE" | "BAD_TYPE"; message: string };

/** Validate source or uploaded avatar file metadata (mime + byte size). */
export function validateAvatarFile(input: {
  mime: string;
  size: number;
}): AvatarFileValidation {
  if (!isAllowedAvatarMime(input.mime)) {
    return { ok: false, code: "BAD_TYPE", message: AVATAR_BAD_TYPE_MESSAGE };
  }
  if (input.size <= 0) {
    return { ok: false, code: "TOO_LARGE", message: AVATAR_EMPTY_MESSAGE };
  }
  if (input.size > AVATAR_MAX_BYTES) {
    return { ok: false, code: "TOO_LARGE", message: AVATAR_TOO_LARGE_MESSAGE };
  }
  return { ok: true, mime: input.mime };
}

/** True when URL is a Vercel Blob public URL we may delete. */
export function isVercelBlobUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith(".public.blob.vercel-storage.com") ||
      host.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

/** Sniff JPEG / PNG / WebP magic bytes. */
export function sniffAvatarMime(
  bytes: Uint8Array,
): AvatarAllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
