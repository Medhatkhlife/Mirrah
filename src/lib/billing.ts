/**
 * Subscriptions through Lemon Squeezy (merchant of record; works for sellers Stripe does not serve).
 * Each paid plan has a checkout link from the Lemon Squeezy dashboard, set in env. The organization
 * id travels as checkout custom data and comes back in the signed webhook.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { Store } from "./db/types";
import type { Plan } from "./types";

export const PAID_PLANS = ["pulse", "pulse_coach", "full"] as const satisfies readonly Plan[];
type PaidPlan = (typeof PAID_PLANS)[number];

const checkoutEnv: Record<PaidPlan, string> = {
  pulse: "LEMONSQUEEZY_CHECKOUT_PULSE",
  pulse_coach: "LEMONSQUEEZY_CHECKOUT_PULSE_COACH",
  full: "LEMONSQUEEZY_CHECKOUT_FULL",
};

export const billingEnabled = () => PAID_PLANS.some((p) => Boolean(process.env[checkoutEnv[p]]));

/** Checkout link for a plan, pre-filled with the owner's email and tagged with the organization. */
export function checkoutUrl(plan: PaidPlan, org: { id: string; ownerEmail: string }): string | null {
  const base = process.env[checkoutEnv[plan]];
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("checkout[email]", org.ownerEmail);
  u.searchParams.set("checkout[custom][org_id]", org.id);
  u.searchParams.set("checkout[custom][plan]", plan);
  return u.toString();
}

/** Lemon Squeezy signs the raw body with HMAC-SHA256 (hex) in the X-Signature header. */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

const ACTIVE = new Set(["active", "on_trial", "past_due"]);

/**
 * Apply a subscription webhook. Returns what happened, for logging.
 * active/on_trial/past_due -> the plan; cancelled keeps access until it expires; expired/unpaid -> free.
 */
export async function applySubscriptionEvent(store: Store, payload: unknown): Promise<string> {
  const p = payload as {
    meta?: { event_name?: string; custom_data?: { org_id?: string; plan?: string } };
    data?: { id?: string; attributes?: { status?: string } };
  };
  const event = p.meta?.event_name ?? "";
  if (!event.startsWith("subscription_")) return `ignored ${event}`;
  const orgId = p.meta?.custom_data?.org_id;
  const plan = p.meta?.custom_data?.plan as PaidPlan | undefined;
  const status = p.data?.attributes?.status ?? "";
  if (!orgId || !plan || !PAID_PLANS.includes(plan)) return "missing custom data";
  const org = await store.getOrganization(orgId);
  if (!org) return "unknown organization";

  let next: Plan | null = null;
  if (ACTIVE.has(status)) next = plan;
  else if (status === "expired" || status === "unpaid") next = "free";
  if (next && next !== org.plan) await store.updateOrganization(org.id, { plan: next });

  await store.saveSubscription({
    organizationId: org.id,
    plan,
    status,
    provider: "lemonsqueezy",
    providerRef: p.data?.id ?? null,
  });
  return `${event}: ${org.plan} -> ${next ?? org.plan}`;
}
