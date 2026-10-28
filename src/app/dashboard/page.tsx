import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgDashboard } from "@/components/org-dashboard";
import { Card, Logo, btnSecondary, input } from "@/components/ui";
import { getStore } from "@/lib/db";
import { isOperator } from "@/lib/ops-auth";
import { PLAN_LABELS } from "@/lib/types";
import { opAddCompetitor, opCoach, opRemoveCompetitor, opSaveAgent, opTryAgent, runCycleNow, setPlan } from "../ops/actions";

/** Operator view of any organization's dashboard, plus plan control. */
async function DashboardContent({ searchParams }: PageProps<"/dashboard">) {
  await connection();
  if (!(await isOperator())) redirect("/ops/login");
  const store = getStore();
  const orgs = await store.listOrganizations();
  const { org: orgId } = (await searchParams) as { org?: string };
  const org = orgs.find((o) => o.id === orgId) ?? orgs[0];

  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="flex flex-[1_1_220px] flex-col gap-5 border-l border-line bg-surface p-5">
        <Logo />
        <nav aria-label="أقسام اللوحة" className="flex flex-col gap-1">
          <Link href="/dashboard" className="flex min-h-11 items-center rounded-xl bg-accent-soft px-3 font-semibold text-accent-dark">الشركات</Link>
          <Link href="/ops" className="flex min-h-11 items-center rounded-xl px-3 text-ink">لوحة المشغّل</Link>
        </nav>
        {orgs.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted">الشركات ({orgs.length})</span>
            {orgs.map((o) => (
              <Link key={o.id} href={`/dashboard?org=${o.id}`} className={`rounded-lg px-3 py-2 text-sm ${o.id === org?.id ? "bg-line-soft font-semibold" : ""}`}>{o.name}</Link>
            ))}
          </div>
        )}
        <form action={runCycleNow} className="mt-auto">
          <button className={`${btnSecondary} w-full`}>شغّل الجدولة الآن</button>
        </form>
      </aside>
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 p-6">
        {!org ? (
          <Card><p className="text-muted">لا توجد شركات بعد. ابدأ فحصاً من <Link href="/" className="text-accent underline">الصفحة الرئيسية</Link>.</p></Card>
        ) : (
          <>
            <Card className="flex flex-wrap items-end justify-between gap-4">
              <form action={setPlan} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="organizationId" value={org.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">خطة الشركة (يدوياً حتى يُربط الدفع)</span>
                  <select name="plan" defaultValue={org.plan} className={`${input} min-w-48`}>
                    {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <button className={btnSecondary}>حفظ</button>
              </form>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted">رابط لوحة صاحب الشركة (أرسله له فقط):</span>
                <Link href={`/app/${org.accessToken}`} className="text-accent underline" dir="ltr">/app/{org.accessToken.slice(0, 6)}…</Link>
              </div>
            </Card>
            <OrgDashboard
              store={store}
              org={org}
              actions={{
                addCompetitor: opAddCompetitor.bind(null, org.id),
                removeCompetitor: opRemoveCompetitor.bind(null, org.id),
                saveAgent: opSaveAgent.bind(null, org.id),
                tryAgent: opTryAgent.bind(null, org.id),
                coach: opCoach.bind(null, org.id),
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function Dashboard(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">جارٍ التحميل…</div>}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
