import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cache } from "react";

import { colorModeFromPrisma } from "@/lib/color-mode";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/logging/log-event";
import { normalizeEmail } from "@/lib/normalize-email";
import {
  getSessionMaxAgeSeconds,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/session-constants";

/** Precomputed bcrypt hash of a dummy secret — used so `bcrypt.compare` always runs (timing). */
const DUMMY_PASSWORD_BCRYPT =
  "$2b$12$wIngUcvRlENaoscUlYysUOdE6iPhLjkY7g4YUAesh07.kdy7TPgom";

const nextAuth = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    // Auth.js: credentials as the only provider cannot use `strategy: "database"` (assertConfig).
    // Session is carried in an HTTP-only signed cookie (JWT); Prisma `Session` rows are unused until
    // another provider type is added. Rolling limits: `src/lib/session-constants.ts` (Story 1.4).
    strategy: "jwt",
    maxAge: getSessionMaxAgeSeconds(),
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const startedAt = Date.now();
        const rawEmail = credentials?.email;
        const password = credentials?.password;
        if (typeof rawEmail !== "string" || typeof password !== "string") {
          logEvent({
            level: "info",
            domain: "api",
            route: "/api/auth/callback/credentials",
            action: "login",
            code: "LOGIN_FAILED",
            message: "credentials authorize rejected — malformed credentials",
            context: { durationMs: Date.now() - startedAt },
          });
          return null;
        }
        const email = normalizeEmail(rawEmail);
        const user = await prisma.user.findUnique({ where: { email } });
        const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_BCRYPT;
        const valid = await bcrypt.compare(password, hashToCompare);
        const durationMs = Date.now() - startedAt;
        if (!user?.passwordHash || !valid) {
          logEvent({
            level: "info",
            domain: "api",
            route: "/api/auth/callback/credentials",
            action: "login",
            code: "LOGIN_FAILED",
            message: "credentials authorize rejected",
            context: { durationMs },
          });
          return null;
        }
        logEvent({
          level: "info",
          domain: "api",
          route: "/api/auth/callback/credentials",
          action: "login",
          userId: user.id,
          message: "credentials authorize completed",
          context: { durationMs },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          colorMode: colorModeFromPrisma(user.colorMode),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? null;
        if (user.colorMode === "dark" || user.colorMode === "light") {
          token.colorMode = user.colorMode;
        }
      }
      // Profile (and other) client `update()` calls must not trust client-supplied
      // identity claims — re-read from DB so forged session.update cannot change email/name/image.
      if (trigger === "update" && typeof token.id === "string") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true, colorMode: true, image: true },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.image;
          token.colorMode = colorModeFromPrisma(dbUser.colorMode);
        }
      } else if (
        typeof token.id === "string" &&
        token.picture === undefined
      ) {
        // One-time hydrate for JWTs issued before `picture` was wired.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { image: true },
        });
        token.picture = dbUser?.image ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        if (typeof token.name === "string" || token.name === null) {
          session.user.name = token.name;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.picture === "string" || token.picture === null) {
          session.user.image = token.picture;
        }
        if (token.colorMode === "dark" || token.colorMode === "light") {
          session.user.colorMode = token.colorMode;
        }
      }
      return session;
    },
  },
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

/** Dedupes JWT session resolution within a single RSC request (e.g. layout + page). */
export const auth = cache(nextAuth.auth);
