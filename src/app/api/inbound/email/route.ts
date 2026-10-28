import { timingSafeEqual } from "crypto";
import { getStore } from "@/lib/db";
import { autoSendDraft } from "@/lib/engine/dispatch";
import { EVENTS, emit } from "@/lib/engine/events";
import { recordBusinessReply } from "@/lib/engine/scan";

/**
 * Postmark inbound webhook. Configure the URL as
 *   https://<your-app>/api/inbound/email?secret=<INBOUND_WEBHOOK_SECRET>
 * The mystery customer's Reply-To is <inbound>+<probeId>@..., so MailboxHash is the probe id.
 */
export async function POST(req: Request) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET ?? "";
  const given = new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return new Response("unauthorized", { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const probeId = String(payload.MailboxHash ?? "").trim();
  const body = String(payload.StrippedTextReply || payload.TextBody || "").trim();
  const date = payload.Date ? new Date(String(payload.Date)) : new Date();
  const receivedAt = Number.isNaN(date.getTime()) ? new Date() : date;

  const store = getStore();
  const probe = probeId ? await store.getProbe(probeId) : null;
  // Always 200 for mail we cannot route, so Postmark does not retry forever.
  if (!probe || probe.channel !== "email" || probe.status !== "awaiting_reply" || !body)
    return Response.json({ ignored: true });

  await recordBusinessReply(store, probeId, body, receivedAt);
  await emit(EVENTS.probeReplied, { probeId, round: probe.round });
  await autoSendDraft(store, probeId);
  return Response.json({ ok: true });
}
