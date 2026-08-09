/**
 * POST `/api/profile/avatar` — upload cropped profile image (multipart `file`).
 * DELETE `/api/profile/avatar` — clear `User.image` and best-effort delete Blob.
 */

import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  AVATAR_MAX_BYTES,
  isVercelBlobUrl,
  sniffAvatarMime,
  validateAvatarFile,
} from "@/lib/avatar";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";

async function bestEffortDeleteBlob(url: string | null | undefined) {
  if (!url || !isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (e) {
    console.error("avatar blob delete failed", {
      action: "delete_avatar_blob",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? NaN);
  // Multipart overhead is small; reject clearly oversized bodies before buffering.
  if (Number.isFinite(contentLength) && contentLength > AVATAR_MAX_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: { code: "TOO_LARGE", message: "Image must be 5MB or smaller." } },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid form data" } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing image file",
        },
      },
      { status: 400 },
    );
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: { code: "TOO_LARGE", message: "Image must be 5MB or smaller." } },
      { status: 400 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffAvatarMime(buffer);
  if (!sniffed) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_TYPE",
          message: "Use a JPEG, PNG, or WebP image.",
        },
      },
      { status: 400 },
    );
  }

  const meta = validateAvatarFile({ mime: sniffed, size: buffer.byteLength });
  if (!meta.ok) {
    return NextResponse.json(
      { error: { code: meta.code, message: meta.message } },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });

  const ext =
    sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";

  let uploadedUrl: string | null = null;
  try {
    const blob = await put(
      `avatars/${userId}/${Date.now()}.${ext}`,
      Buffer.from(buffer),
      {
        access: "public",
        contentType: sniffed,
        addRandomSuffix: true,
      },
    );
    uploadedUrl = blob.url;

    await prisma.user.update({
      where: { id: userId },
      data: { image: blob.url },
      select: { image: true },
    });

    await bestEffortDeleteBlob(existing?.image);

    return NextResponse.json({ ok: true, imageUrl: blob.url });
  } catch (e) {
    if (uploadedUrl) {
      await bestEffortDeleteBlob(uploadedUrl);
    }
    console.error("POST /api/profile/avatar unexpected failure", {
      action: "upload_avatar",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  try {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });

    await bestEffortDeleteBlob(existing?.image);

    return NextResponse.json({ ok: true, imageUrl: null });
  } catch (e) {
    console.error("DELETE /api/profile/avatar unexpected failure", {
      action: "remove_avatar",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
