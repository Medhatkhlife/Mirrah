/**
 * Recurring work: weekly scans for paying organizations and the monthly competitor inquiry.
 * Plain functions over a Store; the Inngest cron and tests call them the same way.
 */
import type { Store } from "../db/types";
import type { Competitor, Organization, Probe, Scan } from "../types";
import { channelsFor, createScan } from "./scan";

export const MAX_COMPETITORS = 3;
const DAY = 24 * 3600_000;
export const WEEKLY_INTERVAL_DAYS = 7;
export const COMPETITOR_INTERVAL_DAYS = 30;

type Started = { scan: Scan; probes: Probe[] };

export async function addCompetitor(
  store: Store,
  organizationId: string,
  input: { name: string; website: string | null; whatsapp: string | null; email: string | null },
): Promise<Competitor> {
  const name = input.name.trim();
  if (!name) throw new Error("اكتب اسم المنافس.");
  if (!input.website && !input.whatsapp && !input.email)
    throw new Error("أدخل رقم واتساب أو موقعاً أو بريداً للمنافس.");
  const existing = await store.listCompetitors(organizationId);
  if (existing.length >= MAX_COMPETITORS) throw new Error(`الحد الأقصى ${MAX_COMPETITORS} منافسين.`);
  return store.createCompetitor({ organizationId, ...input, name });
}

export async function removeCompetitor(store: Store, organizationId: string, competitorId: string) {
  const c = await store.getCompetitor(competitorId);
  if (!c || c.organizationId !== organizationId) throw new Error("المنافس غير موجود.");
  await store.deleteCompetitor(competitorId);
}

/** Paid plans get weekly scans and competitor comparisons. */
export const isPaid = (o: Organization) => o.plan !== "free";

/** Start a weekly scan when the newest own scan is at least a week old. */
export async function dueWeeklyScan(store: Store, org: Organization, now: Date): Promise<Started | null> {
  if (!isPaid(org) || channelsFor(org).length === 0) return null;
  const own = (await store.listScans(org.id)).filter((s) => s.kind !== "competitor");
  if (own.some((s) => s.status === "running")) return null;
  const lastAt = Math.max(0, ...own.map((s) => new Date(s.createdAt).getTime()));
  if (now.getTime() - lastAt < WEEKLY_INTERVAL_DAYS * DAY) return null;
  return createScan(store, org, { kind: "weekly" }, { clock: () => now });
}

/** At most one inquiry per competitor every 30 days. */
export async function dueCompetitorScans(store: Store, org: Organization, now: Date): Promise<Started[]> {
  if (!isPaid(org)) return [];
  const scans = await store.listScans(org.id);
  const out: Started[] = [];
  for (const c of await store.listCompetitors(org.id)) {
    const mine = scans.filter((s) => s.competitorId === c.id);
    const lastAt = Math.max(0, ...mine.map((s) => new Date(s.createdAt).getTime()));
    if (mine.length && now.getTime() - lastAt < COMPETITOR_INTERVAL_DAYS * DAY) continue;
    if (channelsFor(c).length === 0) continue;
    out.push(await createScan(store, org, { kind: "competitor", competitor: c }, { clock: () => now }));
  }
  return out;
}

/** One pass over every organization. Errors in one organization never stop the others. */
export async function runRecurringCycle(store: Store, now: Date) {
  const started: Started[] = [];
  const failures: { organizationId: string; error: string }[] = [];
  for (const org of await store.listOrganizations()) {
    try {
      const w = await dueWeeklyScan(store, org, now);
      if (w) started.push(w);
      started.push(...(await dueCompetitorScans(store, org, now)));
    } catch (e) {
      failures.push({ organizationId: org.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { started, failures };
}
