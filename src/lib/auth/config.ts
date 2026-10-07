import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verifyCredentialsWithProtection } from "@/features/auth/services/login-protection.service";
import { db } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const validation = loginSchema.safeParse({
          email: credentials.email,
          password: credentials.password,
        });

        if (!validation.success) {
          return null;
        }

        // Same protected check as /api/auth/login so this endpoint can't be
        // used to guess passwords without throttling or lockout.
        let user;
        try {
          user = await verifyCredentialsWithProtection(
            validation.data.email,
            validation.data.password
          );
        } catch {
          return null;
        }

        await db.user.update({
          where: { id: BigInt(user.internalId) },
          data: { last_login_at: new Date() },
        });

        return {
          id: String(user.internalId),
          name: user.name,
          email: user.email ?? "",
          image: user.avatar ?? null,
          role: user.roleName,
          phone: user.phone ?? null,
          status: user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.phone = (user as { phone?: string | null }).phone ?? null;
        token.status = (user as { status?: string }).status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.phone = (token.phone as string | null) ?? null;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
});
