/**
 * The reply agent (full plan): answers customers from the business knowledge base outside working
 * hours, hands off to a human when needed, and logs every message for the owner's dashboard.
 */
import { createHmac, timingSafeEqual } from "crypto";
import * as ai from "../ai";
import type { Store } from "../db/types";
import { sendHandoff } from "../notify";
import type { Organization } from "../types";

/** Hour (0-23) in Palestine time. */
export function hebronHour(at: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Hebron" }).format(at),
  );
}

/** "always" or "FROM-TO" hours; "17-9" wraps past midnight. Invalid -> never. */
export function withinAgentHours(spec: string, at: Date): boolean {
  if (spec.trim() === "always") return true;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(spec.trim());
  if (!m) return false;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from > 23 || to > 23 || from === to) return false;
  const h = hebronHour(at);
  return from < to ? h >= from && h < to : h >= from || h < to;
}

export const agentAllowed = (org: Organization) => org.plan === "full";

export interface AgentTurn {
  reply: string;
  handoff: boolean;
  handoffSummary: string;
}

/**
 * Handle one customer message. Returns null when the agent should stay silent (disabled, outside
 * its hours, or plan without the agent) so the business's own team handles it.
 */
export async function handleCustomerMessage(
  store: Store,
  org: Organization,
  customer: string,
  text: string,
  at: Date,
  opts: { ignoreHours?: boolean } = {},
): Promise<AgentTurn | null> {
  if (!agentAllowed(org)) return null;
  if (!opts.ignoreHours && (!org.agentEnabled || !withinAgentHours(org.agentHours, at))) return null;
  const body = text.trim().slice(0, 4000);
  if (!body) return null;

  const history = await store.listAgentMessages(org.id, customer, 12);
  await store.addAgentMessage({
    organizationId: org.id,
    customer,
    sender: "customer",
    body,
    handoff: false,
    sentAt: at.toISOString(),
  });
  const out = await ai.replyAgent({
    knowledgeBase: org.knowledgeBase || "لا توجد معلومات مسجلة بعد.",
    history: history.map((h) => ({ from: h.sender === "customer" ? "customer" : "agent", text: h.body })),
    customerMessage: body,
  });
  const handoff = out.action === "handoff";
  await store.addAgentMessage({
    organizationId: org.id,
    customer,
    sender: "agent",
    body: out.message,
    handoff,
    sentAt: new Date(at.getTime() + 1000).toISOString(),
  });
  if (handoff && customer !== "playground") await sendHandoff(org, customer, out.handoffSummary);
  return { reply: out.message, handoff, handoffSummary: out.handoffSummary };
}

// WhatsApp Cloud API ---------------------------------------------------------

export const waConfig = {
  token: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0",
};

/** Meta signs webhook bodies: X-Hub-Signature-256: sha256=<hex HMAC of raw body with app secret>. */
export function verifyMetaSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  return expected.length === header.length && timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}

export interface IncomingWhatsApp {
  phoneNumberId: string;
  from: string;
  text: string;
  at: Date;
}

/** Extract text messages from a WhatsApp Cloud API webhook payload. Other types are skipped. */
export function parseWhatsAppPayload(payload: unknown): IncomingWhatsApp[] {
  const out: IncomingWhatsApp[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: { value?: Record<string, unknown> }[] }[]) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = String((value.metadata as { phone_number_id?: string })?.phone_number_id ?? "");
      for (const m of (value.messages as Record<string, unknown>[] | undefined) ?? []) {
        if (m.type !== "text") continue;
        const text = String((m.text as { body?: string })?.body ?? "");
        const ts = Number(m.timestamp);
        out.push({
          phoneNumberId,
          from: String(m.from ?? ""),
          text,
          at: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
        });
      }
    }
  }
  return out.filter((m) => m.phoneNumberId && m.from && m.text);
}

export async function sendWhatsAppText(phoneNumberId: string, to: string, body: string) {
  if (!waConfig.token) {
    console.info(`[whatsapp skipped: not configured] to=${to}`);
    return false;
  }
  const res = await fetch(`https://graph.facebook.com/${waConfig.graphVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${waConfig.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error("[whatsapp send failed]", res.status, await res.text());
  return res.ok;
}
