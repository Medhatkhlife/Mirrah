"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { EVENTS, emit } from "@/lib/engine/inngest";
import { closeWithoutReply, markDraftSent, recordBusinessReply } from "@/lib/engine/scan";
import { isOperator, loginOperator } from "@/lib/ops-auth";

async function guard() {
  if (!(await isOperator())) redirect("/ops/login");
}

export async function login(form: FormData) {
  const ok = await loginOperator(String(form.get("password") ?? ""));
  redirect(ok ? "/ops" : "/ops/login?error=1");
}

export async function confirmSent(form: FormData) {
  await guard();
  const probeId = String(form.get("probeId"));
  const p = await markDraftSent(getStore(), probeId);
  await emit(EVENTS.probeSent, { probeId, round: p.round });
  revalidatePath("/ops");
}

export async function submitReply(form: FormData) {
  await guard();
  const probeId = String(form.get("probeId"));
  const body = String(form.get("body") ?? "");
  const minutesAgo = Math.max(0, Number(form.get("minutesAgo") ?? 0) || 0);
  const store = getStore();
  const before = await store.getProbe(probeId);
  await recordBusinessReply(store, probeId, body, new Date(Date.now() - minutesAgo * 60_000));
  if (before) await emit(EVENTS.probeReplied, { probeId, round: before.round });
  revalidatePath("/ops");
}

export async function closeProbe(form: FormData) {
  await guard();
  await closeWithoutReply(getStore(), String(form.get("probeId")));
  revalidatePath("/ops");
}
