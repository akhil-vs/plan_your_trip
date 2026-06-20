import type { SubscriptionPlan } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { planForStripePriceId } from "@/lib/billing/plans";

export async function applySubscriptionPlan(
  userId: string,
  plan: SubscriptionPlan,
  stripeSubscriptionId: string | null
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      stripeSubscriptionId,
    },
  });
}

export async function syncUserPlanFromStripeSubscription(
  userId: string,
  subscription: Stripe.Subscription
) {
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id;
  const mapped = planForStripePriceId(priceId);

  if (status === "active" || status === "trialing") {
    await applySubscriptionPlan(
      userId,
      mapped ?? "PRO",
      subscription.id
    );
    return;
  }

  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    await applySubscriptionPlan(userId, "FREE", null);
  }
}

export async function findUserIdForStripeCustomer(customerId: string) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}
