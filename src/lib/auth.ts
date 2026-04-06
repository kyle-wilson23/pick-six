import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize-email";
import {
  getSessionMaxAgeSeconds,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/session-constants";

/** Precomputed bcrypt hash of a dummy secret — used so `bcrypt.compare` always runs (timing). */
const DUMMY_PASSWORD_BCRYPT =
  "$2b$12$wIngUcvRlENaoscUlYysUOdE6iPhLjkY7g4YUAesh07.kdy7TPgom";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        const rawEmail = credentials?.email;
        const password = credentials?.password;
        if (typeof rawEmail !== "string" || typeof password !== "string") {
          return null;
        }
        const email = normalizeEmail(rawEmail);
        const user = await prisma.user.findUnique({ where: { email } });
        const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_BCRYPT;
        const valid = await bcrypt.compare(password, hashToCompare);
        if (!user?.passwordHash || !valid) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
