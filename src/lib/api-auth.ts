import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/lib/auth";

/** Matches Auth.js default cookie name for non-__Secure__ dev; must match `encode` in mobile login. */
export const AUTH_JS_SESSION_SALT = "authjs.session-token";

export function getAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

export type ApiUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  plan: "FREE" | "PRO" | "TEAM";
  isAdmin: boolean;
};

/**
 * Resolves the current user from the incoming request: session cookie (web) or
 * `Authorization: Bearer <Auth.js JWT>` (mobile). Use this in Route Handlers instead of `auth()` alone.
 */
export async function getApiUser(request: NextRequest): Promise<ApiUser | null> {
  const secret = getAuthSecret();
  if (!secret) return null;

  const token = await getToken({
    req: request,
    secret,
    salt: AUTH_JS_SESSION_SALT,
  });

  if (token) {
    const id =
      (typeof token.id === "string" && token.id) ||
      (typeof token.sub === "string" && token.sub) ||
      null;
    if (id) {
      return {
        id,
        email: (token.email as string | undefined) ?? null,
        name: (token.name as string | undefined) ?? null,
        plan:
          (token.plan as "FREE" | "PRO" | "TEAM" | undefined) ?? "FREE",
        isAdmin: Boolean(token.isAdmin),
      };
    }
  }

  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    plan: session.user.plan ?? "FREE",
    isAdmin: session.user.isAdmin ?? false,
  };
}
