import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bubble, Card, Logo, Tag, btnPrimary, btnSecondary, fmtDate, input } from "@/components/ui";
import { aiMode, dbMode } from "@/lib/config";
import { billingEnabled } from "@/lib/billing";
import { emailEnabled, probeEmailEnabled } from "@/lib/email";
import { waConfig } from "@/lib/engine/agent";
import { inngestEnabled } from "@/lib/engine/events";
import { getStore } from "@/lib/db";
import { isOperator } from "@/lib/ops-auth";
import { formatMinutes } from "@/lib/scoring";
import { CHANNEL_LABELS, type Organization, type Probe } from "@/lib/types";
import { closeProbe, confirmSent, submitReply } from "./actions";

function contactFor(o: Organization, p: Probe) {
  if (p.channel === "whatsapp") return o.whatsapp;
  if (p.channel === "email") return o.email;
  return o.website;
}

async function OpsPageContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  if (!(await isOperator())) redirect("/ops/login");
  const store = getStore();
  const open = await store.listProbesByStatus(["awaiting_send", "awaiting_reply"]);

  const items = [];
  for (const probe of open) {
    const scan = await store.getScan(probe.scanId);
    if (!scan) continue;
    const org = await store.getOrganization(scan.organizationId);
    if (!org) continue;
    const messages = await store.listMessages(probe.id);
    items.push({ probe, scan, org, messages });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag tone={aiMode() === "live" ? "good" : "neutral"}>Claude: {aiMode() === "live" ? "متصل" : "وضع تجريبي"}</Tag>
          <Tag tone={dbMode() === "supabase" ? "good" : "neutral"}>البيانات: {dbMode() === "supabase" ? "Supabase" : "ملف محلي"}</Tag>
          <Tag tone={inngestEnabled() ? "good" : "neutral"}>الجدولة: {inngestEnabled() ? "Inngest" : "فورية"}</Tag>
          <Tag tone={emailEnabled() ? "good" : "neutral"}>البريد: {emailEnabled() ? (probeEmailEnabled() ? "كامل" : "للمالكين فقط") : "غير مفعّل"}</Tag>
          <Tag tone={billingEnabled() ? "good" : "neutral"}>الدفع: {billingEnabled() ? "مفعّل" : "يدوي"}</Tag>
          <Tag tone={waConfig.token ? "good" : "neutral"}>وكيل واتساب: {waConfig.token ? "مفعّل" : "غير مفعّل"}</Tag>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl bg-warn-soft p-3 text-warn">{error}</p>}
      <h1 className="text-2xl font-bold">لوحة المشغّل</h1>
      <p className="mt-1 mb-6 text-muted">
        أرسل رسالة الزبون السري من الجوال المخصص، ثم أكّد الإرسال، والصق رد الشركة هنا حين يصل.
      </p>

      {items.length === 0 && (
        <Card>
          <p className="text-muted">لا توجد محاولات مفتوحة. اطلب فحصاً من <Link href="/" className="text-accent underline">الصفحة الرئيسية</Link>.</p>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {items.map(({ probe, scan, org, messages }) => {
          const draft = messages.find((m) => m.status === "draft");
          const sent = messages.filter((m) => m.status === "sent");
          return (
            <Card key={probe.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{org.name}</div>
                  <div className="text-sm text-muted">
                    {CHANNEL_LABELS[probe.channel]} · <span dir="ltr">{contactFor(org, probe)}</span> · الجولة {probe.round}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {probe.status === "awaiting_send" ? <Tag tone="accent">بانتظار الإرسال</Tag> : <Tag tone="warn">بانتظار رد الشركة</Tag>}
                  {probe.firstResponseMinutes !== null && <Tag tone="neutral">أول رد: {formatMinutes(probe.firstResponseMinutes)}</Tag>}
                  <Link href={`/r/${scan.reportToken}`} className="text-sm text-accent underline">التقرير</Link>
                  <Link href={`/dashboard?org=${org.id}`} className="text-sm text-accent underline">الشركة</Link>
                </div>
              </div>

              {sent.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl bg-ground p-3">
                  {sent.map((m) => (
                    <Bubble key={m.id} from={m.sender} meta={fmtDate(m.sentAt)}>{m.body}</Bubble>
                  ))}
                </div>
              )}

              {probe.status === "awaiting_send" && draft && (
                <form action={confirmSent} className="flex flex-col gap-3 rounded-xl border border-dashed border-accent p-4">
                  <input type="hidden" name="probeId" value={probe.id} />
                  <span className="text-sm font-semibold">الرسالة المقترحة (انسخها وأرسلها كما هي):</span>
                  <p className="select-all whitespace-pre-wrap rounded-lg bg-accent-soft p-3 leading-7">{draft.body}</p>
                  <button className={btnPrimary}>أرسلتها الآن</button>
                </form>
              )}

              {probe.status === "awaiting_reply" && (
                <form action={submitReply} className="flex flex-col gap-3">
                  <input type="hidden" name="probeId" value={probe.id} />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">رد الشركة كما وصل</span>
                    <textarea name="body" required rows={3} className={`${input} py-3`} />
                  </label>
                  <label className="flex max-w-xs flex-col gap-1.5">
                    <span className="text-sm font-semibold">وصل قبل كم دقيقة؟</span>
                    <input name="minutesAgo" type="number" min={0} defaultValue={0} className={input} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className={btnPrimary}>سجّل الرد</button>
                    <button formAction={closeProbe} formNoValidate className={btnSecondary}>أغلق بلا رد</button>
                  </div>
                </form>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function OpsPage(props: PageProps<"/ops">) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">جارٍ التحميل…</div>}>
      <OpsPageContent searchParams={props.searchParams as Promise<{ error?: string }>} />
    </Suspense>
  );
}
