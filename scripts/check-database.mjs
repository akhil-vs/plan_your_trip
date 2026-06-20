#!/usr/bin/env node
/**
 * Quick DATABASE_URL connectivity check (run from repo root).
 * Usage: node scripts/check-database.mjs
 * Loads .env via dotenv if present; on Vercel use `vercel env pull` first.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

let host = "(unknown)";
try {
  host = new URL(url).hostname;
} catch {
  /* ignore */
}

console.log(`Checking database host: ${host}`);

if (host === "db.prisma.io") {
  console.warn(
    "\nWarning: db.prisma.io often means an old Prisma Data Platform URL.\n" +
      "For production (e.g. viazo.cc), use Neon, Vercel Postgres, or Supabase and set DATABASE_URL in Vercel.\n"
  );
}

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;
  const count = await prisma.user.count();
  console.log(`OK — connected. user table has ${count} row(s).`);
} catch (e) {
  console.error("FAILED —", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
