import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

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
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            plan: true,
          },
        });

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

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
        const row = await prisma.user.findUnique({
          where: { id: token.id },
          select: { email: true },
        });
        if (row?.email) token.email = row.email;
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
