import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/lib/db/memory-store";
import {
  handleCustomerMessage,
  hebronHour,
  parseWhatsAppPayload,
  verifyMetaSignature,
  withinAgentHours,
} from "../src/lib/engine/agent";
import { coachOrganization } from "../src/lib/engine/coach";
import { launchProbe, markDraftSent, recordBusinessReply, startFreeScan } from "../src/lib/engine/scan";

// 2026-11-02 is in winter time (UTC+2) in Palestine.
const atHebron = (h: number) => new Date(Date.UTC(2026, 10, 2, (h - 2 + 24) % 24, 0));

async function fullOrg() {
  const store = new MemoryStore();
  const { organization, probes } = await startFreeScan(
    store,
    { name: "ش", sector: "real_estate", city: "", website: null, whatsapp: "+970590000000", email: null, ownerEmail: "o@x.example", consent: true },
    { siteText: "" },
  );
  const org = await store.updateOrganization(organization.id, {
    plan: "full",
    agentEnabled: true,
    agentHours: "17-9",
    knowledgeBase: "شقق 3 غرف تبدأ من 90 ألف دولار",
    waPhoneNumberId: "PN1",
  });
  return { store, org, probes };
}

describe("agent hours", () => {
  it("reads Palestine time and wraps past midnight", () => {
    expect(hebronHour(atHebron(18))).toBe(18);
    expect(withinAgentHours("17-9", atHebron(18))).toBe(true);
    expect(withinAgentHours("17-9", atHebron(3))).toBe(true);
    expect(withinAgentHours("17-9", atHebron(12))).toBe(false);
    expect(withinAgentHours("9-17", atHebron(12))).toBe(true);
    expect(withinAgentHours("always", atHebron(12))).toBe(true);
    expect(withinAgentHours("bad", atHebron(12))).toBe(false);
    expect(withinAgentHours("25-3", atHebron(1))).toBe(false);
  });
});

describe("reply agent", () => {
  it("replies only on the full plan, when enabled, inside its hours", async () => {
    const { store, org } = await fullOrg();
    expect(await handleCustomerMessage(store, org, "97059", "مرحبا", atHebron(12))).toBeNull();
    const turn = await handleCustomerMessage(store, org, "97059", "مرحبا، عندكم شقق؟", atHebron(20));
    expect(turn?.reply).toBeTruthy();
    expect(await store.listAgentMessages(org.id, "97059", 10)).toHaveLength(2);

    const off = await store.updateOrganization(org.id, { agentEnabled: false });
    expect(await handleCustomerMessage(store, off, "97059", "مرحبا", atHebron(20))).toBeNull();
    const pulse = await store.updateOrganization(org.id, { plan: "pulse", agentEnabled: true });
    expect(await handleCustomerMessage(store, pulse, "97059", "مرحبا", atHebron(20))).toBeNull();
  });

  it("hands off when the customer wants a human", async () => {
    const { store, org } = await fullOrg();
    const turn = await handleCustomerMessage(store, org, "97059", "بدي أحكي مع موظف", atHebron(22));
    expect(turn?.handoff).toBe(true);
    const log = await store.listAgentMessages(org.id, null, 10);
    expect(log.at(-1)?.handoff).toBe(true);
  });
});

describe("whatsapp webhook helpers", () => {
  it("verifies Meta signatures", () => {
    const raw = '{"x":1}';
    const sig = "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");
    expect(verifyMetaSignature(raw, sig, "app-secret")).toBe(true);
    expect(verifyMetaSignature(raw, sig.replace("sha256=", ""), "app-secret")).toBe(false);
    expect(verifyMetaSignature(raw + "x", sig, "app-secret")).toBe(false);
  });

  it("extracts text messages and skips others", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "PN1" },
        messages: [
          { from: "970591", type: "text", timestamp: "1793000000", text: { body: "مرحبا" } },
          { from: "970592", type: "image", timestamp: "1793000001" },
        ],
      } }] }],
    };
    const out = parseWhatsAppPayload(payload);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ phoneNumberId: "PN1", from: "970591", text: "مرحبا" });
    expect(parseWhatsAppPayload({})).toEqual([]);
  });
});

describe("coach", () => {
  it("builds coaching only from conversations with replies", async () => {
    const { store, org, probes } = await fullOrg();
    expect(await coachOrganization(store, org)).toBeNull();
    const p = probes[0].id;
    await launchProbe(store, p);
    await markDraftSent(store, p);
    await recordBusinessReply(store, p, "أهلاً، الأسعار تختلف", new Date());
    await markDraftSent(store, p);
    await recordBusinessReply(store, p, "تفضل زورنا، السعر 90 ألف وبنحجزلك موعد", new Date());
    const out = await coachOrganization(store, org);
    expect(out?.drill).toBeTruthy();
  });
});
