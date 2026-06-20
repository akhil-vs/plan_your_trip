import { NextRequest, NextResponse } from "next/server";
import { normalizeAuthEmail } from "@/lib/auth/normalizeEmail";
import {
  createPasswordResetToken,
  storePasswordResetToken,
} from "@/lib/auth/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = normalizeAuthEmail(body?.email);

  const generic = NextResponse.json({
    message:
      "If an account exists for that email, we sent a link to reset your password.",
  });

  if (!email) {
    return generic;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    return generic;
  }

  const { token, tokenHash } = createPasswordResetToken();
  await storePasswordResetToken(user.id, tokenHash);

  const resetUrl = `${req.nextUrl.origin}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail({ email: user.email, resetUrl });

  return generic;
}
