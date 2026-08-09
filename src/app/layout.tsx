import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { AppProviders } from "@/components/app-providers";
import { auth } from "@/lib/auth";
import {
  COLOR_MODE_COOKIE_NAME,
  type ColorMode,
  colorModeFromPrisma,
  parseColorMode,
} from "@/lib/color-mode";
import { prisma } from "@/lib/db";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pigskin Pick'Em",
  description: "NFL pick'em league manager",
};

async function resolveInitialColorMode(): Promise<ColorMode> {
  const cookieStore = await cookies();
  const fromCookie = parseColorMode(cookieStore.get(COLOR_MODE_COOKIE_NAME)?.value);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fromCookie;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { colorMode: true },
    });
    if (!user) {
      return fromCookie;
    }
    return colorModeFromPrisma(user.colorMode);
  } catch {
    return fromCookie;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialColorMode = await resolveInitialColorMode();

  return (
    <html
      lang="en"
      data-color-mode={initialColorMode}
      style={{ colorScheme: initialColorMode }}
    >
      <body className={inter.className}>
        <AppProviders
          fontFamily={inter.style.fontFamily}
          initialColorMode={initialColorMode}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
