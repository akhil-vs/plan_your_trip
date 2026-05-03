type Props = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(event: string, props?: Props) {
  if (__DEV__) {
    console.log("[mobile-analytics]", event, props || {});
  }
}
