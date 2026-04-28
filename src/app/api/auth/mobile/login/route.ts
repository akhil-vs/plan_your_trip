import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { AUTH_JS_SESSION_SALT, getAuthSecret } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, plan: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const secret = getAuthSecret();
    if (!secret) {
      return NextResponse.json({ error: "Auth secret is not configured" }, { status: 500 });
    }

    const token = await encode({
      secret,
      salt: AUTH_JS_SESSION_SALT,
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        isAdmin: isAdminEmail(user.email),
      },
      maxAge: 60 * 60 * 24 * 14,
    });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
