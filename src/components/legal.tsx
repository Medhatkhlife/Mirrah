import { Logo } from "./ui";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <Logo />
      <p role="note" className="rounded-xl bg-warn-soft p-3 text-sm leading-7 text-warn">
        مسودة أولية للمراجعة. يجب أن يراجعها محامٍ في كل دولة تعمل فيها المنصة قبل الإطلاق.
      </p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="flex flex-col gap-4 leading-8 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pr-6">
        {children}
      </div>
    </div>
  );
}
