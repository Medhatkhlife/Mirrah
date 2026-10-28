import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bubble, Card, Logo, ScoreRing, Tag, btnPrimary, btnSecondary, fmtDate } from "@/components/ui";
import { getStore } from "@/lib/db";
import { loadScanReport } from "@/lib/engine/scan";
import { CRITERIA, criterionLabel, formatMinutes } from "@/lib/scoring";
import { CHANNEL_LABELS, SECTOR_LABELS } from "@/lib/types";

export async function generateMetadata() {
  return { title: "تقرير الأشعة — مِرآة", robots: { index: false, follow: false } };
}

async function ReportPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  await connection();
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const store = getStore();
  const scan = await store.getScanByToken(token);
  if (!scan) notFound();
  const { organization, probes } = await loadScanReport(store, scan);
  if (!organization) notFound();
  const finished = probes.filter((p) => p.probe.status === "finished").length;
  const done = scan.status === "completed";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo size={26} />
        <span className="text-sm text-muted">{fmtDate(scan.createdAt)}</span>
      </div>

      {isNew && !done && (
        <Card className="bg-accent-soft">
          <p className="leading-7">
            بدأ الفحص. سيتواصل الزبون السري مع شركتك خلال الساعات القادمة عبر {probes.length} قنوات. احفظ هذا الرابط؛ التقرير يكتمل هنا تلقائياً.
          </p>
        </Card>
      )}

      <div>
        <span className="text-sm text-muted">تقرير الأشعة · {SECTOR_LABELS[organization.sector]}{organization.city ? ` · ${organization.city}` : ""}</span>
        <h1 className="text-2xl leading-9 font-bold">هذا ما رآه زبونك في {organization.name}</h1>
      </div>

      <Card className="flex items-center gap-5">
        <ScoreRing score={done ? scan.score : null} />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">درجة الاستجابة من 100</span>
          {done ? (
            <span className="text-lg font-bold">اكتمل الفحص: {probes.length} محاولات</span>
          ) : (
            <span className="text-lg font-bold">قيد التنفيذ: اكتملت {finished} من {probes.length}</span>
          )}
        </div>
      </Card>

      <Card className="py-1.5">
        {probes.map(({ probe }) => (
          <div key={probe.id} className="flex items-center justify-between border-b border-line-soft py-3.5 last:border-0">
            <span>{CHANNEL_LABELS[probe.channel]}</span>
            {probe.status !== "finished" ? (
              <Tag tone="neutral">جارٍ</Tag>
            ) : (
              <span className={`font-bold ${probe.noReply || (probe.firstResponseMinutes ?? 0) > 120 ? "text-warn" : "text-good"}`}>
                {probe.noReply ? "لم يُرد" : formatMinutes(probe.firstResponseMinutes)}
              </span>
            )}
          </div>
        ))}
      </Card>

      {probes
        .filter((p) => p.evaluation)
        .map(({ probe, messages, evaluation }) => (
          <Card key={probe.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{CHANNEL_LABELS[probe.channel]}</h2>
              <span className="text-lg font-bold">{evaluation!.score} / 100</span>
            </div>
            {messages.length > 0 && (
              <details className="rounded-xl bg-ground p-3">
                <summary className="cursor-pointer text-sm font-semibold text-accent">اقرأ المحادثة</summary>
                <div className="mt-3 flex flex-col gap-2">
                  {messages.map((m) => (
                    <Bubble key={m.id} from={m.sender} meta={fmtDate(m.sentAt)}>{m.body}</Bubble>
                  ))}
                </div>
              </details>
            )}
            <ul className="flex flex-col gap-2.5">
              {CRITERIA.map((c) => {
                const s = evaluation!.criteria.find((x) => x.key === c.key);
                if (!s) return null;
                return (
                  <li key={c.key} className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between">
                      <span>{criterionLabel(c.key)}</span>
                      <span className={`font-bold ${s.score >= 4 ? "text-good" : s.score <= 1 ? "text-warn" : ""}`}>{s.score} / 5</span>
                    </div>
                    {c.key !== "speed" && s.evidence && <q className="text-muted">{s.evidence}</q>}
                  </li>
                );
              })}
            </ul>
            <p className="rounded-xl bg-accent-soft p-3 text-sm leading-7"><b>اقتراح:</b> {evaluation!.suggestion}</p>
          </Card>
        ))}

      <Link href="/#pricing" className={btnPrimary}>فعّل المراقبة الأسبوعية</Link>
      <div className="flex gap-2.5">
        <Link href="/" className={`${btnSecondary} flex-1`}>افحص شركة أخرى</Link>
      </div>
      <p className="text-center text-xs text-muted">هذا الرابط خاص؛ لا يظهر في محركات البحث ولا يراه إلا من تشاركه معه.</p>
    </div>
  );
}

export default function ReportPage(props: PageProps<"/r/[token]">) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">جارٍ التحميل…</div>}>
      <ReportPageContent {...props} />
    </Suspense>
  );
}
