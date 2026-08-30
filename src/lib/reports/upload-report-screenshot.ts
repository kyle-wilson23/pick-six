import "server-only";

import { put } from "@vercel/blob";

import type { AvatarAllowedMime } from "@/lib/avatar";

export async function uploadReportScreenshot(input: {
  userId: string;
  bytes: Uint8Array;
  contentType: AvatarAllowedMime;
}): Promise<string> {
  const ext =
    input.contentType === "image/png"
      ? "png"
      : input.contentType === "image/webp"
        ? "webp"
        : "jpg";
  const blob = await put(
    `reports/${input.userId}/${Date.now()}.${ext}`,
    Buffer.from(input.bytes),
    {
      access: "public",
      contentType: input.contentType,
      addRandomSuffix: true,
      abortSignal: AbortSignal.timeout(15_000),
    },
  );
  return blob.url;
}
