import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySubscriptionEvent, checkoutUrl, verifySignature } from "../src/lib/billing";
import { MemoryStore } from "../src/lib/db/memory-store";
import { startFreeScan } from "../src/lib/engine/scan";

afterEach(() => vi.unstubAllEnvs());

async function org() {
  const store = new MemoryStore();
  const { organization } = await startFreeScan(
    store,
    { name: "ش", sector: "other", city: "", website: null, whatsapp: "+970590000000", email: null, ownerEmail: "o@x.example", consent: true },
    { siteText: "" },
  );
  return { store, organization };
}

const event = (orgId: string, status: string, name = "subscription_updated", plan = "pulse") => ({
  meta: { event_name: name, custom_data: { org_id: orgId, plan } },
  data: { id: "sub_1", attributes: { status } },
});

describe("billing", () => {
  it("verifies Lemon Squeezy signatures over the raw body", () => {
    const body = '{"a":1}';
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, sig, "")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
  });

  it("tags checkout links with the organization", () => {
    vi.stubEnv("LEMONSQUEEZY_CHECKOUT_PULSE", "https://store.lemonsqueezy.com/buy/abc");
    const url = new URL(checkoutUrl("pulse", { id: "org1", ownerEmail: "o@x.example" })!);
    expect(url.searchParams.get("checkout[custom][org_id]")).toBe("org1");
    expect(url.searchParams.get("checkout[email]")).toBe("o@x.example");
    expect(checkoutUrl("full", { id: "org1", ownerEmail: "o@x.example" })).toBeNull();
  });

  it("upgrades on active, keeps access when cancelled, downgrades when expired", async () => {
    const { store, organization } = await org();
    await applySubscriptionEvent(store, event(organization.id, "active", "subscription_created"));
    expect((await store.getOrganization(organization.id))?.plan).toBe("pulse");
    await applySubscriptionEvent(store, event(organization.id, "cancelled"));
    expect((await store.getOrganization(organization.id))?.plan).toBe("pulse");
    await applySubscriptionEvent(store, event(organization.id, "expired", "subscription_expired"));
    expect((await store.getOrganization(organization.id))?.plan).toBe("free");
  });

  it("ignores unrelated or malformed events", async () => {
    const { store, organization } = await org();
    expect(await applySubscriptionEvent(store, { meta: { event_name: "order_created" } })).toMatch(/ignored/);
    expect(await applySubscriptionEvent(store, event(organization.id, "active", "subscription_created", "gold"))).toMatch(/missing/);
    expect(await applySubscriptionEvent(store, event("nope", "active"))).toMatch(/unknown/);
    expect((await store.getOrganization(organization.id))?.plan).toBe("free");
  });
});
