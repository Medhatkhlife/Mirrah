import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { OrgDashboard } from "@/components/org-dashboard";
import { Card, Logo } from "@/components/ui";
import { getStore } from "@/lib/db";
import { ownerAddCompetitor, ownerCoach, ownerRemoveCompetitor, ownerSaveAgent, ownerTryAgent } from "./actions";

export async function generateMetadata() {
  return { title: "لوحتك — مِرآة", robots: { index: false, follow: false } };
}

async function OwnerDashboard({ params, searchParams }: PageProps<"/app/[token]">) {
  await connection();
  const { token } = await params;
  const { new: isNew } = (await searchParams) as { new?: string };
  const store = getStore();
  const org = await store.getOrganizationByToken(token);
  if (!org) notFound();

  return (
    <OrgDashboard
      store={store}
      org={org}
      actions={{
        addCompetitor: ownerAddCompetitor.bind(null, token),
        removeCompetitor: ownerRemoveCompetitor.bind(null, token),
        saveAgent: ownerSaveAgent.bind(null, token),
        tryAgent: ownerTryAgent.bind(null, token),
        coach: ownerCoach.bind(null, token),
      }}
      notice={
        isNew ? (
          <Card className="bg-accent-soft leading-7">
            <b>بدأ الفحص.</b> سيتواصل الزبون السري مع شركتك خلال الساعات القادمة. احفظ رابط هذه الصفحة:
            هو مفتاح لوحتك الخاصة، فلا تشاركه. رابط التقرير داخلها هو الذي يمكنك مشاركته.
          </Card>
        ) : undefined
      }
    />
  );
}

export default function OwnerPage(props: PageProps<"/app/[token]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <span className="text-sm text-muted">لوحتك الخاصة</span>
      </header>
      <Suspense fallback={<div className="p-8 text-muted">جارٍ التحميل…</div>}>
        <OwnerDashboard {...props} />
      </Suspense>
    </div>
  );
}
