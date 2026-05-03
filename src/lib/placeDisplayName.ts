const MAX_LEN = 56;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Short label for activity / notifications when `name` is often a full postal address.
 * Uses the first comma-separated segment when the string looks like a verbose address.
 */
export function placeNameForActivity(raw: string | null | undefined): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "Stop";
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length >= 2 && s.length > 35) {
    return truncate(parts[0]!, MAX_LEN);
  }
  return truncate(s, MAX_LEN);
}
