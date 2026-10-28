"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db";
import { EVENTS, emit, kickOff } from "@/lib/engine/inngest";
import { addCompetitor, removeCompetitor, runRecurringCycle } from "@/lib/engine/schedule";
import { PLAN_LABELS, type Plan } from "@/lib/types";
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

export async function setPlan(form: FormData) {
  await guard();
  const plan = String(form.get("plan"));
  if (!(plan in PLAN_LABELS)) throw new Error("خطة غير معروفة");
  await getStore().updateOrganization(String(form.get("organizationId")), { plan: plan as Plan });
  revalidatePath("/dashboard");
}

export async function opAddCompetitor(organizationId: string, form: FormData) {
  await guard();
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
  await addCompetitor(getStore(), organizationId, {
    name: String(form.get("name") ?? ""),
    website: clean(form.get("website")),
    whatsapp: clean(form.get("whatsapp")),
    email: clean(form.get("email")),
  });
  revalidatePath("/dashboard");
}

export async function opRemoveCompetitor(organizationId: string, form: FormData) {
  await guard();
  await removeCompetitor(getStore(), organizationId, String(form.get("competitorId")));
  revalidatePath("/dashboard");
}

/** Run the daily recurring pass now (useful in demo mode, where there is no cron). */
export async function runCycleNow() {
  await guard();
  const store = getStore();
  const { started } = await runRecurringCycle(store, new Date());
  for (const s of started) await kickOff(store, s.scan, s.probes);
  revalidatePath("/ops");
  revalidatePath("/dashboard");
}
