import { NextResponse } from "next/server";
import { isBillablePlanConfigured } from "@/lib/billing/plans";
import { isStripeConfigured } from "@/lib/stripe/client";

export async function GET() {
  return NextResponse.json({
    stripeEnabled: isStripeConfigured(),
    proCheckout: isStripeConfigured() && isBillablePlanConfigured("PRO"),
    teamCheckout: isStripeConfigured() && isBillablePlanConfigured("TEAM"),
  });
}
