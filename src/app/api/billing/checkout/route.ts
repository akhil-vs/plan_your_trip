import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { ensureStripeCustomer } from "@/lib/billing/ensureStripeCustomer";
import { getStripePriceId, type BillablePlan } from "@/lib/billing/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this server" },
      { status: 503 }
    );
  }

  const authUser = await getApiUser(req);
  if (!authUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as BillablePlan | undefined;
  if (plan !== "PRO" && plan !== "TEAM") {
    return NextResponse.json({ error: "plan must be PRO or TEAM" }, { status: 400 });
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price for ${plan} is not configured` },
      { status: 503 }
    );
  }

  const customerId = await ensureStripeCustomer(authUser.id);
  if (!customerId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/profile?billing=success`,
    cancel_url: `${origin}/pricing?billing=cancelled`,
    metadata: { userId: authUser.id, plan },
    subscription_data: {
      metadata: { userId: authUser.id, plan },
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
