import { Prisma } from "@prisma/client";

/** Prisma cannot open a TCP connection to the database (wrong host, down, firewall, expired URL). */
export function isDatabaseUnreachable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1003"].includes(error.code);
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes("Can't reach database server") ||
      msg.includes("Connection refused") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND")
    );
  }
  return false;
}

/** Safe message for API clients; never echoes full connection strings. */
export function databaseUnavailableMessage(): string {
  return "Cannot reach the database. The server DATABASE_URL is missing, invalid, or points to a host that is down. If you run this site, set DATABASE_URL in Vercel (or your host) to a working PostgreSQL URL (Neon, Vercel Postgres, etc.), run migrations, and redeploy.";
}
