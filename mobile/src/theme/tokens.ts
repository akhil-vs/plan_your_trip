/** Aligns with web `globals.css` brand + neutral scale for a cohesive product feel. */
export const colors = {
  brandPrimary: "#2563eb",
  brandPrimaryDark: "#1d4ed8",
  brandAccent: "#0ea5e9",
  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  success: "#16a34a",
  danger: "#dc2626",
  overlay: "rgba(15, 23, 42, 0.06)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  title: { fontSize: 26, fontWeight: "700" as const, color: colors.text, letterSpacing: -0.3 },
  headline: { fontSize: 18, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  caption: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  overline: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;
