import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export async function storePasswordResetToken(userId: string, tokenHash: string) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!row || row.expiresAt < new Date()) {
    if (row) {
      await prisma.passwordResetToken.delete({ where: { id: row.id } });
    }
    return null;
  }
  await prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } });
  return row.userId;
}
