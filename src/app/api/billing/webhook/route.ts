import { applySubscriptionEvent, verifySignature } from "@/lib/billing";
import { getStore } from "@/lib/db";

/** Lemon Squeezy webhook: https://<your-app>/api/billing/webhook, with LEMONSQUEEZY_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";
  if (!verifySignature(raw, req.headers.get("x-signature"), secret))
    return new Response("invalid signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const result = await applySubscriptionEvent(getStore(), payload);
  console.info("[billing]", result);
  return Response.json({ ok: true, result });
}
