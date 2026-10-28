/**
 * Dashboard action implementations shared by the owner link and the operator view.
 * The callers authenticate (token or operator cookie) and resolve the organization first.
 */
import { getStore } from "./db";
import { agentAllowed, handleCustomerMessage, withinAgentHours } from "./engine/agent";
import { coachAllowed, coachOrganization } from "./engine/coach";
import { addCompetitor, removeCompetitor } from "./engine/schedule";
import type { Organization } from "./types";

export interface PlaygroundState {
  reply: string | null;
  handoff: boolean;
  error: string | null;
}
export interface CoachState {
  mistakes: string[];
  drill: string | null;
  error: string | null;
}

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

export async function doAddCompetitor(org: Organization, form: FormData) {
  await addCompetitor(getStore(), org.id, {
    name: String(form.get("name") ?? ""),
    website: clean(form.get("website")),
    whatsapp: clean(form.get("whatsapp")),
    email: clean(form.get("email")),
  });
}

export async function doRemoveCompetitor(org: Organization, form: FormData) {
  await removeCompetitor(getStore(), org.id, String(form.get("competitorId")));
}

export async function doSaveAgent(org: Organization, form: FormData) {
  if (!agentAllowed(org)) throw new Error("وكيل الرد متاح في النظام الكامل فقط.");
  const hours = String(form.get("agentHours") ?? "").trim() || "17-9";
  // Validate the hours format by evaluating it once; invalid formats never run.
  if (hours !== "always" && !/^\d{1,2}-\d{1,2}$/.test(hours)) throw new Error("صيغة الساعات غير صحيحة.");
  withinAgentHours(hours, new Date());
  await getStore().updateOrganization(org.id, {
    knowledgeBase: String(form.get("knowledgeBase") ?? "").slice(0, 20_000),
    agentHours: hours,
    agentEnabled: form.get("agentEnabled") === "on",
    waPhoneNumberId: clean(form.get("waPhoneNumberId")),
  });
}

export async function doTryAgent(org: Organization, form: FormData): Promise<PlaygroundState> {
  if (!agentAllowed(org)) return { reply: null, handoff: false, error: "وكيل الرد متاح في النظام الكامل فقط." };
  const text = String(form.get("message") ?? "");
  if (!text.trim()) return { reply: null, handoff: false, error: "اكتب رسالة لتجربتها." };
  try {
    const turn = await handleCustomerMessage(getStore(), org, "playground", text, new Date(), { ignoreHours: true });
    if (!turn) return { reply: null, handoff: false, error: "تعذر توليد رد." };
    return { reply: turn.reply, handoff: turn.handoff, error: null };
  } catch (e) {
    console.error(e);
    return { reply: null, handoff: false, error: "حدث خطأ أثناء توليد الرد." };
  }
}

export async function doCoach(org: Organization): Promise<CoachState> {
  if (!coachAllowed(org)) return { mistakes: [], drill: null, error: "المدرّب متاح في خطة النبض + المدرّب وما فوق." };
  try {
    const out = await coachOrganization(getStore(), org);
    if (!out) return { mistakes: [], drill: null, error: "لا توجد محادثات فيها ردود بعد لنبني عليها التدريب." };
    return { mistakes: out.recurringMistakes, drill: out.drill, error: null };
  } catch (e) {
    console.error(e);
    return { mistakes: [], drill: null, error: "حدث خطأ أثناء إعداد التدريب." };
  }
}
