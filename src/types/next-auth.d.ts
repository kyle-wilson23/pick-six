import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

import type { ColorMode } from "@/lib/color-mode";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      colorMode?: ColorMode;
    } & DefaultSession["user"];
  }

  interface User {
    colorMode?: ColorMode;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    colorMode?: ColorMode;
  }
}
