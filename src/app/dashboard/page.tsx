import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bubble, Card, Logo, Tag, fmtDate } from "@/components/ui";
import { getStore } from "@/lib/db";
import { loadScanReport } from "@/lib/engine/scan";
import { isOperator } from "@/lib/ops-auth";
import { formatMinutes } from "@/lib/scoring";
import { CHANNEL_LABELS, SECTOR_LABELS, type Channel } from "@/lib/types";

/**
 * Customer dashboard. Until customer accounts ship (phase 3), it is visible to the operator only
 * and lets them pick an organization.
 */
async function DashboardContent({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  await connection();
  if (!(await isOperator())) redirect("/ops/login");
  const store = getStore();
  const orgs = await store.listOrganizations();
  const { org: orgId } = await searchParams;
  const org = orgs.find((o) => o.id === orgId) ?? orgs[0];

  if (!org) {
    return (
      <Shell>
        <Card><p className="text-muted">لا توجد شركات بعد. ابدأ فحصاً من <Link href="/" className="text-accent underline">الصفحة الرئيسية</Link>.</p></Card>
      </Shell>
    );
  }

  const scans = await store.listScans(org.id);
  const completed = scans.filter((s) => s.status === "completed");
  const latest = completed[0] ?? null;
  const first = completed.at(-1) ?? null;
  const report = latest ? await loadScanReport(store, latest) : null;

  const byChannel = new Map<Channel, { minutes: (number | null)[]; scores: number[] }>();
  for (const p of report?.probes ?? []) {
    const e = byChannel.get(p.probe.channel) ?? { minutes: [], scores: [] };
    e.minutes.push(p.probe.noReply ? null : p.probe.firstResponseMinutes);
    if (p.evaluation) e.scores.push(p.evaluation.score);
    byChannel.set(p.probe.channel, e);
  }
  const lastConversation = report?.probes.find((p) => p.messages.length > 1) ?? null;
  const trend = [...completed].reverse().map((s) => s.score ?? 0);

  return (
    <Shell orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} current={org.id}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-sm text-muted">{org.name} · {SECTOR_LABELS[org.sector]}{org.city ? ` · ${org.city}` : ""}</span>
          <h1 className="text-3xl font-bold">نظرة عامة</h1>
        </div>
        {scans[0] && <Link href={`/r/${scans[0].reportToken}`} className="text-accent underline">آخر تقرير</Link>}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="درجة الاستجابة" value={latest?.score ?? "—"} unit="/ 100"
          note={first && latest && first.id !== latest.id ? `${(latest.score ?? 0) - (first.score ?? 0) >= 0 ? "+" : ""}${(latest.score ?? 0) - (first.score ?? 0)} منذ أول فحص` : "أول فحص"} />
        <Kpi label="فحوصات مكتملة" value={completed.length} unit="" note={`${scans.length - completed.length} قيد التنفيذ`} />
        <Kpi label="محاولات بلا رد" value={(report?.probes ?? []).filter((p) => p.probe.noReply).length} unit={`من ${report?.probes.length ?? 0}`} note="في آخر فحص" />
        <Kpi label="الخطة" value={org.plan === "free" ? "مجانية" : org.plan} unit="" note="الاشتراكات قريباً" />
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
          <p className="text-muted">لا توجد نتائج مكتملة بعد.</p>
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
    </Shell>
  );
}

function Shell({ children, orgs, current }: { children: React.ReactNode; orgs?: { id: string; name: string }[]; current?: string }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="flex flex-[1_1_220px] flex-col gap-5 border-l border-line bg-surface p-5">
        <Logo />
        <nav aria-label="أقسام اللوحة" className="flex flex-col gap-1">
          <Link href="/dashboard" className="flex min-h-11 items-center rounded-xl bg-accent-soft px-3 font-semibold text-accent-dark">نظرة عامة</Link>
          <Link href="/ops" className="flex min-h-11 items-center rounded-xl px-3 text-ink">لوحة المشغّل</Link>
        </nav>
        {orgs && orgs.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted">الشركات</span>
            {orgs.map((o) => (
              <Link key={o.id} href={`/dashboard?org=${o.id}`} className={`rounded-lg px-3 py-2 text-sm ${o.id === current ? "bg-line-soft font-semibold" : ""}`}>{o.name}</Link>
            ))}
          </div>
        )}
        <div className="mt-auto"><Tag tone="neutral">العملاء يدخلون بحساباتهم في المرحلة 3</Tag></div>
      </aside>
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 p-6">{children}</main>
    </div>
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

export default function Dashboard(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">جارٍ التحميل…</div>}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
