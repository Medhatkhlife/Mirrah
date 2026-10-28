import Link from "next/link";
import { Bubble, Card, Tag, btnPrimary, btnSecondary, fmtDate, input } from "@/components/ui";
import type { Store } from "@/lib/db/types";
import { loadScanReport } from "@/lib/engine/scan";
import { MAX_COMPETITORS, isPaid } from "@/lib/engine/schedule";
import { PAID_PLANS, billingEnabled, checkoutUrl } from "@/lib/billing";
import { formatMinutes } from "@/lib/scoring";
import { agentAllowed } from "@/lib/engine/agent";
import { coachAllowed } from "@/lib/engine/coach";
import type { CoachState, PlaygroundState } from "@/lib/dashboard-actions";
import { AgentPlayground, CoachPanel } from "./agent-client";
import { CHANNEL_LABELS, PLAN_LABELS, SECTOR_LABELS, type Channel, type Organization } from "@/lib/types";

/** Server actions bound to the viewer (owner token or operator). */
export interface DashboardActions {
  addCompetitor: (form: FormData) => Promise<void>;
  removeCompetitor: (form: FormData) => Promise<void>;
  saveAgent: (form: FormData) => Promise<void>;
  tryAgent: (s: PlaygroundState, form: FormData) => Promise<PlaygroundState>;
  coach: (s: CoachState) => Promise<CoachState>;
}

/** The organization dashboard, shared by the owner's private link and the operator view. */
export async function OrgDashboard({
  store,
  org,
  actions,
  notice,
}: {
  store: Store;
  org: Organization;
  actions: DashboardActions;
  notice?: React.ReactNode;
}) {
  const scans = await store.listScans(org.id);
  const own = scans.filter((s) => s.kind !== "competitor");
  const completed = own.filter((s) => s.status === "completed");
  const latest = completed[0] ?? null;
  const first = completed.at(-1) ?? null;
  const report = latest ? await loadScanReport(store, latest) : null;
  const competitors = await store.listCompetitors(org.id);
  const agentLog = agentAllowed(org) ? await store.listAgentMessages(org.id, null, 30) : [];
  const realAgentLog = agentLog.filter((m) => m.customer !== "playground");

  const byChannel = new Map<Channel, { minutes: (number | null)[]; scores: number[] }>();
  for (const p of report?.probes ?? []) {
    const e = byChannel.get(p.probe.channel) ?? { minutes: [], scores: [] };
    e.minutes.push(p.probe.noReply ? null : p.probe.firstResponseMinutes);
    if (p.evaluation) e.scores.push(p.evaluation.score);
    byChannel.set(p.probe.channel, e);
  }
  const lastConversation = report?.probes.find((p) => p.messages.length > 1) ?? null;
  const trend = [...completed].reverse().map((s) => s.score ?? 0);

  // Latest completed competitor score per competitor.
  const rivalRows = competitors.map((c) => {
    const s = scans.find((x) => x.competitorId === c.id && x.status === "completed");
    const running = scans.some((x) => x.competitorId === c.id && x.status === "running");
    return { c, score: s?.score ?? null, running, at: s?.completedAt ?? null };
  });
  const delta = first && latest && first.id !== latest.id ? (latest.score ?? 0) - (first.score ?? 0) : null;

  return (
    <div className="flex flex-col gap-5">
      {notice}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-sm text-muted">{org.name} · {SECTOR_LABELS[org.sector]}{org.city ? ` · ${org.city}` : ""}</span>
          <h1 className="text-3xl font-bold">نظرة عامة</h1>
        </div>
        {own[0] && <Link href={`/r/${own[0].reportToken}`} className="text-accent underline">آخر تقرير (رابط قابل للمشاركة)</Link>}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="درجة الاستجابة" value={latest?.score ?? "—"} unit="/ 100"
          note={delta === null ? (latest ? "أول فحص" : "لم يكتمل أي فحص بعد") : `${delta >= 0 ? "+" : ""}${delta} منذ أول فحص`} />
        <Kpi label="فحوصات مكتملة" value={completed.length} unit="" note={`${own.length - completed.length} قيد التنفيذ`} />
        <Kpi label="محاولات بلا رد" value={(report?.probes ?? []).filter((p) => p.probe.noReply).length} unit={`من ${report?.probes.length ?? 0}`} note="في آخر فحص" />
        <Kpi label="الخطة" value={PLAN_LABELS[org.plan]} unit="" note={isPaid(org) ? "فحص أسبوعي تلقائي" : "فحص مجاني واحد"} />
      </div>

      {trend.length > 1 && (
        <Card>
          <h2 className="mb-3 text-lg font-bold">درجتك فحصاً بعد فحص</h2>
          <Trend values={trend} />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-bold">الأداء حسب القناة (آخر فحص)</h2>
        {byChannel.size === 0 ? (
          <p className="text-muted">لا توجد نتائج مكتملة بعد. الزبون السري يعمل الآن، والنتائج تظهر هنا تلقائياً.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-right">
              <thead className="text-sm text-muted">
                <tr><th className="border-b border-line p-2 font-semibold">القناة</th><th className="border-b border-line p-2 font-semibold">أول رد</th><th className="border-b border-line p-2 font-semibold">الدرجة</th></tr>
              </thead>
              <tbody>
                {[...byChannel.entries()].map(([ch, v]) => {
                  const score = v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null;
                  return (
                    <tr key={ch}>
                      <td className="border-b border-line-soft p-2">{CHANNEL_LABELS[ch]}</td>
                      <td className="border-b border-line-soft p-2">{v.minutes.map(formatMinutes).join("، ")}</td>
                      <td className={`border-b border-line-soft p-2 font-bold ${score !== null && score < 50 ? "text-warn" : ""}`}>{score ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">أنت مقابل منافسيك</h2>
          <span className="text-sm text-muted">حتى {MAX_COMPETITORS} منافسين · أسماؤهم تظهر لك وحدك</span>
        </div>
        {!isPaid(org) && (
          <p className="rounded-xl bg-line-soft p-3 text-sm leading-7">
            المقارنة بالمنافسين متاحة في الخطط المدفوعة: استفسار واحد عادي لكل منافس كل 30 يوماً، كأي زبون.
          </p>
        )}
        {rivalRows.length > 0 && (
          <ul className="flex flex-col gap-3">
            <Bar label="أنت" score={latest?.score ?? null} own />
            {rivalRows.map(({ c, score, running }) => (
              <li key={c.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    {running ? <Tag tone="neutral">قيد الفحص</Tag> : <span className="font-bold">{score ?? "—"}</span>}
                    <form action={actions.removeCompetitor}>
                      <input type="hidden" name="competitorId" value={c.id} />
                      <button className="min-h-9 rounded-lg px-2 text-sm text-muted underline" aria-label={`احذف ${c.name}`}>حذف</button>
                    </form>
                  </div>
                </div>
                <div className="h-3 rounded-md bg-line-soft"><div className="h-3 rounded-md bg-muted" style={{ width: `${score ?? 0}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
        {competitors.length < MAX_COMPETITORS && (
          <form action={actions.addCompetitor} className="grid gap-3 rounded-xl border border-dashed border-line p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">اسم المنافس</span><input name="name" required className={input} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">واتساب</span><input name="whatsapp" dir="ltr" className={input} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">الموقع</span><input name="website" dir="ltr" className={input} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">البريد</span><input name="email" type="email" dir="ltr" className={input} /></label>
            <button className={`${btnSecondary} sm:col-span-2`}>أضف منافساً</button>
          </form>
        )}
      </Card>

      {lastConversation && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">آخر محادثة للزبون السري</h2>
            <span className="text-sm text-muted">{CHANNEL_LABELS[lastConversation.probe.channel]} · {fmtDate(lastConversation.probe.createdAt)}</span>
          </div>
          {lastConversation.messages.map((m) => (
            <Bubble key={m.id} from={m.sender} meta={fmtDate(m.sentAt)}>{m.body}</Bubble>
          ))}
          {lastConversation.evaluation && (
            <p className="rounded-xl bg-accent-soft p-3 text-sm leading-7"><b>اقتراح Claude:</b> {lastConversation.evaluation.suggestion}</p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">المدرّب</h2>
        {coachAllowed(org) ? (
          <>
            <p className="text-sm leading-7 text-muted">يقرأ Claude آخر محادثات الزبون السري ويستخرج الأخطاء المتكررة وتمريناً لفريقك.</p>
            <CoachPanel action={actions.coach} />
          </>
        ) : (
          <p className="text-sm leading-7 text-muted">متاح في خطة النبض + المدرّب وما فوق.</p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">وكيل الرد</h2>
          {agentAllowed(org) && <Tag tone={org.agentEnabled ? "good" : "neutral"}>{org.agentEnabled ? "يعمل" : "متوقف"}</Tag>}
        </div>
        {!agentAllowed(org) ? (
          <p className="text-sm leading-7 text-muted">متاح في النظام الكامل: وكيل Claude يرد على زبائنك في واتساب خارج الدوام، ويحوّل الجاهزين للشراء إلى فريقك.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <form action={actions.saveAgent} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">ما يعرفه الوكيل عن شركتك</span>
                <textarea name="knowledgeBase" rows={8} defaultValue={org.knowledgeBase ?? ""} placeholder="الأسعار، المنتجات، أوقات الدوام، العنوان، الأسئلة الشائعة…" className={`${input} py-3 leading-7`} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">ساعات العمل (توقيت فلسطين)</span>
                <input name="agentHours" defaultValue={org.agentHours ?? "17-9"} dir="ltr" className={input} />
                <span className="text-xs text-muted">مثال: 17-9 من 5 مساءً حتى 9 صباحاً، أو always لكل الوقت</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">معرّف رقم واتساب (Phone number ID)</span>
                <input name="waPhoneNumberId" defaultValue={org.waPhoneNumberId ?? ""} dir="ltr" className={input} />
                <span className="text-xs text-muted">من إعدادات WhatsApp Cloud API لرقم شركتك. نساعدك في الربط.</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" name="agentEnabled" defaultChecked={org.agentEnabled} className="size-5 accent-[var(--color-accent)]" />
                <span>شغّل الوكيل</span>
              </label>
              <button className={btnSecondary}>حفظ الإعدادات</button>
            </form>
            <div className="flex flex-col gap-4">
              <AgentPlayground action={actions.tryAgent} />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">آخر رسائل الوكيل مع الزبائن ({realAgentLog.length})</span>
                {realAgentLog.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد محادثات حقيقية بعد.</p>
                ) : (
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-ground p-3">
                    {realAgentLog.map((m) => (
                      <Bubble key={m.id} from={m.sender === "customer" ? "customer" : "business"} meta={`${m.customer} · ${fmtDate(m.sentAt)}${m.handoff ? " · حُوّلت لموظف" : ""}`}>{m.body}</Bubble>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">خطتك: {PLAN_LABELS[org.plan]}</h2>
        {billingEnabled() ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {PAID_PLANS.map((plan) => {
              const href = checkoutUrl(plan, org);
              const current = org.plan === plan;
              return (
                <div key={plan} className={`flex flex-col gap-2 rounded-xl border p-4 ${current ? "border-accent" : "border-line"}`}>
                  <span className="font-semibold">{PLAN_LABELS[plan]}</span>
                  {current ? (
                    <Tag tone="good">خطتك الحالية</Tag>
                  ) : href ? (
                    <a href={href} className={plan === "pulse_coach" ? btnPrimary : btnSecondary}>اشترك</a>
                  ) : (
                    <span className="text-sm text-muted">غير متاحة حالياً</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm leading-7 text-muted">
            الاشتراك الإلكتروني لم يُفعّل بعد. للترقية تواصل معنا وسنفعّل خطتك يدوياً.{" "}
            <Link href="/#pricing" className="text-accent underline">قارن الخطط</Link>
          </p>
        )}
      </Card>
    </div>
  );
}

function Bar({ label, score, own }: { label: string; score: number | null; own?: boolean }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className={`flex justify-between text-sm ${own ? "font-bold" : ""}`}><span>{label}</span><span>{score ?? "—"}</span></div>
      <div className="h-3 rounded-md bg-line-soft"><div className="h-3 rounded-md bg-accent" style={{ width: `${score ?? 0}%` }} /></div>
    </li>
  );
}

function Kpi({ label, value, unit, note }: { label: string; value: string | number; unit: string; note: string }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-3xl font-bold">{value} <span className="text-base font-normal text-muted">{unit}</span></span>
      <span className="text-sm text-muted">{note}</span>
    </Card>
  );
}

function Trend({ values }: { values: number[] }) {
  const w = 600, h = 180, pad = 30;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - pad - (v / 100) * (h - 2 * pad);
  // RTL reading: first scan on the right.
  const pts = values.map((v, i) => `${w - x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`الدرجات: ${values.join("، ")}`}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="var(--color-line-soft)" />
          <text x={w - 8} y={y(g) + 4} fontSize="12" fill="var(--color-muted)" textAnchor="end">{g}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round" />
      {values.map((v, i) => (
        <text key={i} x={w - x(i)} y={y(v) - 10} fontSize="13" fontWeight="700" fill="var(--color-ink)" textAnchor="middle">{v}</text>
      ))}
    </svg>
  );
}
