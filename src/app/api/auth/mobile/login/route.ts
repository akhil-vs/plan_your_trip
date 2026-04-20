import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { encode } from "@auth/core/jwt";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import {
  AUTH_JS_SESSION_SALT,
  getAuthSecret,
} from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const secret = getAuthSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      plan: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const isValid = await compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        isAdmin: isAdminEmail(user.email),
      },
      secret,
      salt: AUTH_JS_SESSION_SALT,
      maxAge: 30 * 24 * 60 * 60,
    });
  } catch (err) {
    console.error("[mobile/login] JWT encode failed:", err);
    return NextResponse.json(
      {
        error:
          "Could not create session. Set AUTH_SECRET or NEXTAUTH_SECRET in the server .env and restart Next.js.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      isAdmin: isAdminEmail(user.email),
    },
  });
}
