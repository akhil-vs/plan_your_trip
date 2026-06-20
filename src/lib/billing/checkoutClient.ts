export type BillablePlan = "PRO" | "TEAM";

export async function startCheckout(plan: BillablePlan) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Could not start checkout"
    );
  }
  if (typeof data?.url === "string") {
    window.location.href = data.url;
    return;
  }
  throw new Error("Checkout URL missing");
}

export async function openBillingPortal() {
  const res = await fetch("/api/billing/portal", {
    method: "POST",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Could not open billing portal"
    );
  }
  if (typeof data?.url === "string") {
    window.location.href = data.url;
    return;
  }
  throw new Error("Portal URL missing");
}
