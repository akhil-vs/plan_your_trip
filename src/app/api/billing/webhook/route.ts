import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  applySubscriptionPlan,
  findUserIdForStripeCustomer,
  syncUserPlanFromStripeSubscription,
} from "@/lib/billing/syncSubscription";
import { planForStripePriceId } from "@/lib/billing/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";

export const runtime = "nodejs";

async function userIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): Promise<string | null> {
  const id = metadata?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET missing" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        (await userIdFromMetadata(session.metadata)) ??
        (typeof session.customer === "string"
          ? await findUserIdForStripeCustomer(session.customer)
          : null);
      if (!userId) break;

      const metaPlan = session.metadata?.plan;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await syncUserPlanFromStripeSubscription(userId, sub);
      } else if (metaPlan === "PRO" || metaPlan === "TEAM") {
        await applySubscriptionPlan(userId, metaPlan, subscriptionId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId =
        (await userIdFromMetadata(subscription.metadata)) ??
        (typeof subscription.customer === "string"
          ? await findUserIdForStripeCustomer(subscription.customer)
          : null);
      if (!userId) break;

      if (event.type === "customer.subscription.deleted") {
        await applySubscriptionPlan(userId, "FREE", null);
      } else {
        await syncUserPlanFromStripeSubscription(userId, subscription);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) break;
      const userId = await findUserIdForStripeCustomer(customerId);
      if (!userId) break;
      const priceId = invoice.lines.data[0]?.price?.id;
      const mapped = planForStripePriceId(priceId);
      if (!mapped) {
        await applySubscriptionPlan(userId, "FREE", null);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
