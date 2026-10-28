import { getStore } from "@/lib/db";
import {
  handleCustomerMessage,
  parseWhatsAppPayload,
  sendWhatsAppText,
  verifyMetaSignature,
  waConfig,
} from "@/lib/engine/agent";

/**
 * WhatsApp Cloud API webhook for the reply agent: https://<your-app>/api/whatsapp
 * GET  = Meta's verification handshake (hub.verify_token must equal WHATSAPP_VERIFY_TOKEN).
 * POST = incoming messages, signed with the app secret.
 * Each organization's own WhatsApp Business number is linked by its phone number id.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && waConfig.verifyToken && q.get("hub.verify_token") === waConfig.verifyToken)
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), waConfig.appSecret))
    return new Response("invalid signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const store = getStore();
  for (const msg of parseWhatsAppPayload(payload)) {
    try {
      const org = await store.getOrganizationByWaPhone(msg.phoneNumberId);
      if (!org) continue;
      const turn = await handleCustomerMessage(store, org, msg.from, msg.text, msg.at);
      if (turn) await sendWhatsAppText(msg.phoneNumberId, msg.from, turn.reply);
    } catch (e) {
      // Never fail the webhook for one message; Meta would retry the whole batch.
      console.error("[whatsapp agent]", e);
    }
  }
  return Response.json({ ok: true });
}
