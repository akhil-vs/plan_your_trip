import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { normalizeAuthEmail } from "@/lib/auth/normalizeEmail";
import { SIGN_IN_ERROR_CODES } from "@/lib/auth/signInResultMessage";
import { isDatabaseUnreachable } from "@/lib/prisma/errors";

function throwCredentialsSignIn(code: string): never {
  const err = new CredentialsSignin();
  err.code = code;
  throw err;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use the request Host (e.g. localhost:3001) instead of a fixed NEXTAUTH_URL port for redirects.
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeAuthEmail(credentials?.email);
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              name: true,
              email: true,
              passwordHash: true,
              plan: true,
            },
          });
        } catch (e) {
          if (isDatabaseUnreachable(e)) {
            throwCredentialsSignIn(SIGN_IN_ERROR_CODES.databaseUnavailable);
          }
          throwCredentialsSignIn(SIGN_IN_ERROR_CODES.serviceError);
        }

        if (!user) return null;

        let isValid: boolean;
        try {
          isValid = await compare(password, user.passwordHash);
        } catch {
          throwCredentialsSignIn(SIGN_IN_ERROR_CODES.serviceError);
        }

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          isAdmin: isAdminEmail(user.email),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id: string;
          email?: string | null;
          plan?: "FREE" | "PRO" | "TEAM";
          isAdmin?: boolean;
        };
        token.id = u.id;
        if (u.email) token.email = u.email;
        token.plan = u.plan || "FREE";
        token.isAdmin = Boolean(u.isAdmin);
      }
      // Legacy JWTs may lack email; hydrate once so ADMIN_EMAILS / isAdmin work.
      if (!token.email && typeof token.id === "string") {
        try {
          const row = await prisma.user.findUnique({
            where: { id: token.id },
            select: { email: true },
          });
          if (row?.email) token.email = row.email;
        } catch {
          // DB down: avoid failing the whole sign-in with a generic Configuration error.
        }
      }
      // Keep admin flag in sync on every request (matches ADMIN_EMAILS in env).
      if (typeof token.email === "string" && token.email.length > 0) {
        token.isAdmin = isAdminEmail(token.email);
      }
      if (trigger === "update" && session) {
        const nextPlan = (session as { plan?: "FREE" | "PRO" | "TEAM" }).plan;
        if (nextPlan === "FREE" || nextPlan === "PRO" || nextPlan === "TEAM") {
          token.plan = nextPlan;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const id = (token.id ?? token.sub) as string | undefined;
        if (id) session.user.id = id;
        const email =
          (typeof token.email === "string" && token.email) ||
          (typeof session.user.email === "string" && session.user.email) ||
          "";
        if (email) session.user.email = email;
        session.user.plan = (token.plan as "FREE" | "PRO" | "TEAM" | undefined) || "FREE";
        session.user.isAdmin = email ? isAdminEmail(email) : Boolean(token.isAdmin);
      }
      return session;
    },
  },
});
