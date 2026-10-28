/**
 * The scan engine: plain async functions over a Store. Next.js server actions, Inngest functions
 * and tests all call these, so the behaviour is identical everywhere.
 */
import { randomBytes } from "crypto";
import * as ai from "../ai";
import { config } from "../config";
import type { Store } from "../db/types";
import { scanScore, speedScore, weightedScore } from "../scoring";
import type { Channel, CriterionScore, Organization, Probe, Scan, Sector } from "../types";
import { fetchSiteText } from "./site";

export interface ScanRequest {
  name: string;
  sector: Sector;
  city: string;
  website: string | null;
  whatsapp: string | null;
  email: string | null;
  ownerEmail: string;
  consent: boolean;
}

type Clock = () => Date;
const systemClock: Clock = () => new Date();

const minutesBetween = (a: string, b: string) =>
  Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);

export function validateScanRequest(r: ScanRequest): string | null {
  if (!r.consent) return "يجب الموافقة على أنك صاحب الشركة أو مفوّض عنها.";
  if (!r.name.trim()) return "اكتب اسم الشركة.";
  if (!/^\S+@\S+\.\S+$/.test(r.ownerEmail)) return "اكتب بريداً إلكترونياً صحيحاً لاستلام التقرير.";
  if (!r.whatsapp && !r.website && !r.email)
    return "أدخل رقم واتساب أو موقعاً أو بريداً للشركة حتى نتواصل معها.";
  return null;
}

/** Channels we can reach for this organization. */
export function channelsFor(o: Pick<Organization, "whatsapp" | "website" | "email">): Channel[] {
  const out: Channel[] = [];
  if (o.whatsapp) out.push("whatsapp");
  if (o.website) out.push("web_form");
  if (o.email) out.push("email");
  return out;
}

/** Create the organization, scenario, scan and its probes. Probes start "scheduled". */
export async function startFreeScan(
  store: Store,
  req: ScanRequest,
  opts: { clock?: Clock; siteText?: string } = {},
): Promise<{ organization: Organization; scan: Scan; probes: Probe[] }> {
  const err = validateScanRequest(req);
  if (err) throw new Error(err);
  const now = (opts.clock ?? systemClock)();

  const organization = await store.createOrganization({
    name: req.name.trim(),
    sector: req.sector,
    city: req.city.trim(),
    website: req.website,
    whatsapp: req.whatsapp,
    email: req.email,
    ownerEmail: req.ownerEmail.trim(),
    plan: "free",
  });

  const siteText = opts.siteText ?? (req.website ? await fetchSiteText(req.website) : "");
  const s = await ai.generateScenario({ sector: req.sector, city: req.city, siteText });
  const scenario = await store.createScenario({ sector: req.sector, ...s });

  const scan = await store.createScan({
    organizationId: organization.id,
    competitorId: null,
    kind: "free",
    status: "running",
    scenarioId: scenario.id,
    reportToken: randomBytes(16).toString("base64url"),
    score: null,
    completedAt: null,
  });

  // Spread attempts over time so we see daytime and evening behaviour.
  const offsetsHours = [0, 6, 20];
  const probes: Probe[] = [];
  for (const [i, channel] of channelsFor(organization).entries()) {
    probes.push(
      await store.createProbe({
        scanId: scan.id,
        channel,
        scheduledAt: new Date(now.getTime() + offsetsHours[i % offsetsHours.length] * 3600_000).toISOString(),
        status: "scheduled",
        round: 0,
        firstResponseMinutes: null,
        noReply: false,
        finishedAt: null,
      }),
    );
  }
  return { organization, scan, probes };
}

/** Draft the opening customer message. The operator (or a channel sender) then sends it. */
export async function launchProbe(store: Store, probeId: string, clock: Clock = systemClock) {
  const probe = await mustProbe(store, probeId);
  if (probe.status !== "scheduled") return probe;
  const scan = await mustScan(store, probe.scanId);
  const scenario = await store.getScenario(scan.scenarioId);
  if (!scenario) throw new Error("scenario missing");
  await store.addMessage({
    probeId,
    sender: "customer",
    body: scenario.openingMessage,
    sentAt: clock().toISOString(),
    status: "draft",
  });
  return store.updateProbe(probeId, { status: "awaiting_send" });
}

/** Mark the current draft as sent (operator confirms, or an automated sender succeeded). */
export async function markDraftSent(store: Store, probeId: string, clock: Clock = systemClock) {
  const probe = await mustProbe(store, probeId);
  if (probe.status !== "awaiting_send") throw new Error("لا توجد رسالة بانتظار الإرسال.");
  const draft = (await store.listMessages(probeId)).find((m) => m.status === "draft");
  if (!draft) throw new Error("لا توجد مسودة.");
  await store.updateMessage(draft.id, { status: "sent", sentAt: clock().toISOString() });
  return store.updateProbe(probeId, { status: "awaiting_reply", round: probe.round + 1 });
}

/** Record what the business answered, then draft the next customer turn or finish. */
export async function recordBusinessReply(
  store: Store,
  probeId: string,
  body: string,
  receivedAt: Date,
) {
  const probe = await mustProbe(store, probeId);
  if (probe.status !== "awaiting_reply") throw new Error("هذه المحاولة لا تنتظر رداً.");
  if (!body.trim()) throw new Error("نص الرد فارغ.");
  const before = await store.listMessages(probeId);
  const firstCustomer = before.find((m) => m.sender === "customer" && m.status === "sent");
  const hadReply = before.some((m) => m.sender === "business");
  await store.addMessage({
    probeId,
    sender: "business",
    body: body.trim(),
    sentAt: receivedAt.toISOString(),
    status: "sent",
  });
  if (!hadReply && firstCustomer) {
    await store.updateProbe(probeId, {
      firstResponseMinutes: Math.round(minutesBetween(firstCustomer.sentAt, receivedAt.toISOString())),
    });
  }

  const scan = await mustScan(store, probe.scanId);
  const scenario = await store.getScenario(scan.scenarioId);
  if (!scenario) throw new Error("scenario missing");
  const messages = await store.listMessages(probeId);
  const turn = await ai.nextCustomerMessage({ scenario, messages, round: probe.round });
  if (turn.done || !turn.message.trim()) return finishProbe(store, probeId, receivedAt);

  await store.addMessage({
    probeId,
    sender: "customer",
    body: turn.message.trim(),
    sentAt: receivedAt.toISOString(),
    status: "draft",
  });
  return store.updateProbe(probeId, { status: "awaiting_send" });
}

/** The waiting window ended (or the operator closed it). */
export async function closeWithoutReply(store: Store, probeId: string, clock: Clock = systemClock) {
  const probe = await mustProbe(store, probeId);
  if (probe.status === "finished") return probe;
  // An unsent draft stays a draft: it is excluded from evaluation and reports.
  const msgs = await store.listMessages(probeId);
  const replied = msgs.some((m) => m.sender === "business");
  if (!replied) await store.updateProbe(probeId, { noReply: true, firstResponseMinutes: null });
  return finishProbe(store, probeId, clock());
}

/** Evaluate the conversation, score it, and finalize the scan when every probe is done. */
export async function finishProbe(store: Store, probeId: string, at: Date) {
  const probe = await mustProbe(store, probeId);
  const scan = await mustScan(store, probe.scanId);
  const scenario = await store.getScenario(scan.scenarioId);
  if (!scenario) throw new Error("scenario missing");
  const messages = (await store.listMessages(probeId)).filter((m) => m.status === "sent");

  const judged = await ai.evaluateConversation({ scenario, messages });
  const criteria: CriterionScore[] = [
    {
      key: "speed",
      score: speedScore(probe.firstResponseMinutes),
      evidence: "محسوبة من توقيت الرسائل",
    },
    { key: "answered_question", ...judged.answered_question },
    { key: "closing_attempt", ...judged.closing_attempt },
    { key: "follow_up", ...judged.follow_up },
    { key: "courtesy", ...judged.courtesy },
  ];
  if (!(await store.getEvaluation(probeId))) {
    await store.saveEvaluation({
      probeId,
      criteria,
      suggestion: judged.suggestion,
      score: weightedScore(criteria),
      model: ai.modelLabel("smart"),
    });
  }
  const finished = await store.updateProbe(probeId, {
    status: "finished",
    finishedAt: at.toISOString(),
  });
  await maybeFinalizeScan(store, scan.id, at);
  return finished;
}

export async function maybeFinalizeScan(store: Store, scanId: string, at: Date) {
  const probes = await store.listProbes(scanId);
  if (probes.length === 0 || probes.some((p) => p.status !== "finished")) return null;
  const scores: number[] = [];
  for (const p of probes) {
    const e = await store.getEvaluation(p.id);
    if (e) scores.push(e.score);
  }
  return store.updateScan(scanId, {
    status: "completed",
    score: scanScore(scores),
    completedAt: at.toISOString(),
  });
}

/** Everything the report page and dashboard need, in one call. */
export async function loadScanReport(store: Store, scan: Scan) {
  const organization = await store.getOrganization(scan.organizationId);
  const probes = await store.listProbes(scan.id);
  const details = [];
  for (const p of probes) {
    details.push({
      probe: p,
      messages: (await store.listMessages(p.id)).filter((m) => m.status === "sent"),
      evaluation: await store.getEvaluation(p.id),
    });
  }
  return { organization, scan, probes: details };
}

async function mustProbe(store: Store, id: string) {
  const p = await store.getProbe(id);
  if (!p) throw new Error("probe not found");
  return p;
}
async function mustScan(store: Store, id: string) {
  const s = await store.getScan(id);
  if (!s) throw new Error("scan not found");
  return s;
}

export const ENGINE_LIMITS = { maxRounds: config.maxRounds, replyWaitHours: config.replyWaitHours };
