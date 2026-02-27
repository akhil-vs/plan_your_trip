import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    console.log("Registering user");
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email },
      { status: 201 }
    );

  } catch (error: unknown) {
    console.error("Register error:", error);
    const getMessage = (): string => {
      if (error instanceof Error) {
        const e = error as Error & { cause?: unknown; code?: string; meta?: unknown };
        let msg = error.message;
        // Prefer cause when parent message is generic
        const cause = e.cause;
        if (
          (msg === "Internal server error" || msg === "Internal Server Error") &&
          cause
        ) {
          if (cause instanceof Error) msg = cause.message;
          else if (typeof (cause as { message?: string }).message === "string") {
            msg = (cause as { message: string }).message;
          }
        }
        // Prisma/DB errors: code and meta give the real details
        if (e.code) msg = `${e.code}: ${msg}`;
        if (e.meta && typeof e.meta === "object") {
          const metaStr = JSON.stringify(e.meta).slice(0, 300);
          if (metaStr !== "{}") msg = `${msg} | meta: ${metaStr}`;
        }
        return msg;
      }
      if (error && typeof (error as { message?: unknown }).message === "string") {
        return (error as { message: string }).message;
      }
      if (typeof error === "string") return error;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    };
    return NextResponse.json(
      { error: getMessage() },
      { status: 500 }
    );
  }
}
