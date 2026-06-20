import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getStripePriceId, planForStripePriceId } from "@/lib/billing/plans";

describe("billing plans", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("maps configured price ids to plans", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro";
    process.env.STRIPE_PRICE_TEAM_MONTHLY = "price_team";
    expect(getStripePriceId("PRO")).toBe("price_pro");
    expect(planForStripePriceId("price_team")).toBe("TEAM");
    expect(planForStripePriceId("price_unknown")).toBeNull();
  });
});
