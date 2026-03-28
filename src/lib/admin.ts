/**
 * Parse at call time (not module load) so Vercel/serverless always sees runtime env.
 * Supports comma, semicolon, or newline-separated lists in ADMIN_EMAILS.
 */
function adminEmailSet(): Set<string> {
  const raw = process.env["ADMIN_EMAILS"] ?? "";
  return new Set(
    raw
      .split(/[,;\n]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return adminEmailSet().has(email.toLowerCase());
}

