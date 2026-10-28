import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/lib/db/memory-store";
import { startFreeScan, type ScanRequest } from "../src/lib/engine/scan";
import {
  MAX_COMPETITORS,
  addCompetitor,
  removeCompetitor,
  runRecurringCycle,
} from "../src/lib/engine/schedule";

const req: ScanRequest = {
  name: "مكتب تجريبي",
  sector: "real_estate",
  city: "رام الله",
  website: null,
  whatsapp: "+970590000000",
  email: null,
  ownerEmail: "owner@example.com",
  consent: true,
};
const DAY = 24 * 3600_000;
const T0 = new Date("2026-11-01T09:00:00Z");
const after = (days: number) => new Date(T0.getTime() + days * DAY);

async function setup(plan: "free" | "pulse") {
  const store = new MemoryStore();
  const { organization, scan } = await startFreeScan(store, req, { siteText: "", clock: () => T0 });
  // Pretend the free scan finished at T0.
  await store.updateScan(scan.id, { status: "completed", score: 50, completedAt: T0.toISOString(), createdAt: T0.toISOString() });
  await store.updateOrganization(organization.id, { plan });
  return { store, org: (await store.getOrganization(organization.id))! };
}

describe("owner access", () => {
  it("gives each organization a unique secret dashboard token", async () => {
    const store = new MemoryStore();
    const a = await startFreeScan(store, req, { siteText: "" });
    const b = await startFreeScan(store, req, { siteText: "" });
    expect(a.organization.accessToken.length).toBeGreaterThanOrEqual(20);
    expect(a.organization.accessToken).not.toBe(b.organization.accessToken);
    expect((await store.getOrganizationByToken(a.organization.accessToken))?.id).toBe(a.organization.id);
    expect(await store.getOrganizationByToken("wrong")).toBeNull();
  });
});

describe("competitors", () => {
  it("validates, limits to three, and only removes own competitors", async () => {
    const { store, org } = await setup("pulse");
    await expect(addCompetitor(store, org.id, { name: " ", website: null, whatsapp: "1", email: null })).rejects.toThrow();
    await expect(addCompetitor(store, org.id, { name: "أ", website: null, whatsapp: null, email: null })).rejects.toThrow();
    for (let i = 0; i < MAX_COMPETITORS; i++)
      await addCompetitor(store, org.id, { name: `منافس ${i}`, website: null, whatsapp: `+97059000000${i}`, email: null });
    await expect(addCompetitor(store, org.id, { name: "زائد", website: null, whatsapp: "9", email: null })).rejects.toThrow(/الحد الأقصى/);

    const other = await startFreeScan(store, req, { siteText: "" });
    const [first] = await store.listCompetitors(org.id);
    await expect(removeCompetitor(store, other.organization.id, first.id)).rejects.toThrow();
    await removeCompetitor(store, org.id, first.id);
    expect(await store.listCompetitors(org.id)).toHaveLength(MAX_COMPETITORS - 1);
  });
});

describe("recurring cycle", () => {
  it("never schedules anything for free organizations", async () => {
    const { store } = await setup("free");
    const { started } = await runRecurringCycle(store, after(30));
    expect(started).toHaveLength(0);
  });

  it("starts a weekly scan after 7 days, not before, and not twice", async () => {
    const { store, org } = await setup("pulse");
    expect((await runRecurringCycle(store, after(6))).started).toHaveLength(0);
    const r = await runRecurringCycle(store, after(7));
    expect(r.started).toHaveLength(1);
    expect(r.started[0].scan.kind).toBe("weekly");
    // The new scan is still running, so the next day starts nothing.
    expect((await runRecurringCycle(store, after(8))).started).toHaveLength(0);
    expect((await store.listScans(org.id)).filter((s) => s.kind === "weekly")).toHaveLength(1);
  });

  it("sends one single-channel inquiry per competitor every 30 days", async () => {
    const { store, org } = await setup("pulse");
    const c = await addCompetitor(store, org.id, {
      name: "منافس",
      website: null,
      whatsapp: "+970591111111",
      email: "rival@example.com",
    });
    const r1 = await runRecurringCycle(store, after(1));
    const rival = r1.started.filter((s) => s.scan.kind === "competitor");
    expect(rival).toHaveLength(1);
    expect(rival[0].scan.competitorId).toBe(c.id);
    expect(rival[0].probes).toHaveLength(1);

    expect((await runRecurringCycle(store, after(20))).started.filter((s) => s.scan.kind === "competitor")).toHaveLength(0);
    expect((await runRecurringCycle(store, after(32))).started.filter((s) => s.scan.kind === "competitor")).toHaveLength(1);
  });
});
