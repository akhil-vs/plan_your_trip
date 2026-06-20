/**
 * One-off: create or reset a user by email (password from env only).
 *
 *   node --env-file=.env scripts/upsert-admin-user.mjs
 *
 * Requires: ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD
 * Optional: ADMIN_SEED_NAME (default "Admin")
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD;
const name = (process.env.ADMIN_SEED_NAME ?? "Admin").trim() || "Admin";

if (!email || !password) {
  console.error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (and optionally ADMIN_SEED_NAME).");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      onboardingComplete: true,
    },
    update: {
      passwordHash,
      name,
    },
  });
  console.log("User upserted:", email);
} finally {
  await prisma.$disconnect();
}
