/** Single form for login/register lookups (trim + lowercase). */
export function normalizeAuthEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}
