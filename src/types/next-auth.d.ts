import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      /** Area the role belongs to (roles.scope): "ADMIN" | "AGENT" | "CUSTOMER". */
      scope?: string;
      phone?: string | null;
      status?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    scope?: string;
    phone?: string | null;
    status?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    scope?: string;
    phone?: string | null;
    status?: string;
  }
}
