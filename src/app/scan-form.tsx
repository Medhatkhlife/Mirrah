"use client";

import { useActionState } from "react";
import { requestFreeScan, type ScanFormState } from "./actions";
import { SECTOR_LABELS } from "@/lib/types";
import { btnPrimary, input } from "@/components/ui";

const initial: ScanFormState = { error: null };

export function ScanForm() {
  const [state, action, pending] = useActionState(requestFreeScan, initial);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم الشركة" name="name" required />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">القطاع</span>
          <select name="sector" className={input} defaultValue="real_estate">
            {Object.entries(SECTOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <Field label="رقم واتساب الشركة" name="whatsapp" placeholder="+970 59X XXX XXX" dir="ltr" />
        <Field label="موقع الشركة (اختياري)" name="website" placeholder="example.com" dir="ltr" />
        <Field label="بريد الشركة (اختياري)" name="email" type="email" dir="ltr" />
        <Field label="المدينة" name="city" placeholder="رام الله" />
      </div>
      <Field label="بريدك لاستلام التقرير" name="ownerEmail" type="email" required dir="ltr" />
      <label className="flex items-start gap-2.5 text-sm leading-6">
        <input type="checkbox" name="consent" required className="mt-1 size-5 accent-[var(--color-accent)]" />
        <span>أنا صاحب هذه الشركة أو مفوّض عنها، وأوافق على أن تتواصل معها مِرآة كزبون لغرض هذا الفحص.</span>
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>{pending ? "نجهّز الزبون السري…" : "ابدأ الفحص المجاني"}</button>
      <p className="text-xs text-muted">نتائجك لا يراها أحد غيرك، ولا نحجز أو نطلب شيئاً يكلّف شركتك.</p>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input name={name} className={input} {...rest} />
    </label>
  );
}
