import type { SubscriptionPlan } from "@prisma/client";

export type BillablePlan = "PRO" | "TEAM";

const PRICE_ENV: Record<BillablePlan, string> = {
  PRO: "STRIPE_PRICE_PRO_MONTHLY",
  TEAM: "STRIPE_PRICE_TEAM_MONTHLY",
};

export function getStripePriceId(plan: BillablePlan): string | null {
  const id = process.env[PRICE_ENV[plan]]?.trim();
  return id || null;
}

export function planForStripePriceId(priceId: string | null | undefined): SubscriptionPlan | null {
  if (!priceId) return null;
  const pro = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  const team = process.env.STRIPE_PRICE_TEAM_MONTHLY?.trim();
  if (team && priceId === team) return "TEAM";
  if (pro && priceId === pro) return "PRO";
  return null;
}

export function isBillablePlanConfigured(plan: BillablePlan) {
  return Boolean(getStripePriceId(plan));
}
