/**
 * Product analytics wrapper. In production, wire to your analytics provider.
 * Vercel Web Analytics page views are collected via <Analytics /> in layout.
 */
export function track(event: string, props?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.log("[analytics]", event, props ?? {});
  }
  // Example: send custom events when you add a provider that supports them.
}
