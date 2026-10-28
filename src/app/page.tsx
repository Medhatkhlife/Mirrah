import Link from "next/link";
import { Bubble, Logo, Tag } from "@/components/ui";
import { ScanForm } from "./scan-form";

const steps = [
  { n: "1 · نختبر", t: "زبون سري بلهجة سوقك", d: "يكتب Claude سيناريو زبون يناسب قطاعك، ثم يتواصل معك في أوقات مختلفة عبر قنواتك." },
  { n: "2 · نقيس", t: "درجة من 100 مع الدليل", d: "السرعة، إجابة السؤال، محاولة إتمام البيع، المتابعة واللباقة، ولكل درجة اقتباس من المحادثة." },
  { n: "3 · نُصلح", t: "اقتراحات ووكيل رد", d: "اقتراح محدد بعد كل محادثة، ووكيل ذكي يرد خارج الدوام (قريباً)." },
];

const plans = [
  { name: "النبض", price: "$49", items: ["فحص أسبوعي لقنواتك", "مقارنة بثلاثة منافسين", "شارة مستجيب موثّق"] },
  { name: "النبض + المدرّب", price: "$129", items: ["كل ما في النبض", "تقييم لكل موظف", "تدريب مع زبون افتراضي صعب"], featured: true },
  { name: "النظام الكامل", price: "$249", items: ["كل ما سبق", "وكيل رد ذكي على واتساب والموقع", "تحويل تلقائي للموظف المناسب"] },
];

export default function Home() {
  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Logo />
          <nav aria-label="القائمة الرئيسية" className="flex flex-wrap items-center gap-6 text-[15px]">
            <a href="#how" className="text-ink">كيف تعمل</a>
            <a href="#pricing" className="text-ink">الأسعار</a>
            <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-[#C9C6BC] px-4 text-ink">دخول</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-wrap items-start gap-12 px-6 pt-16 pb-14">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <Tag tone="accent">زبون سري بالذكاء الاصطناعي</Tag>
          <h1 className="text-4xl leading-[1.3] font-bold sm:text-5xl">
            زبونك أرسل رسالة الساعة 9 مساءً.
            <br />
            متى رددت عليه؟
          </h1>
          <p className="text-lg leading-8 text-[#4A5060]">
            مِرآة تتواصل مع شركتك كزبون حقيقي عبر واتساب والموقع والبريد، وتريك ما يراه زبائنك فعلاً، وأين تضيع منك الصفقات.
          </p>
          <ScanForm />
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
            <div className="flex justify-between text-sm text-muted">
              <span>محادثة الزبون السري · واتساب</span>
              <span>مثال توضيحي</span>
            </div>
            <Bubble from="customer" meta="9:02 م">مرحبا، عندكم شقق 3 غرف بالتقسيط؟ وكم الدفعة الأولى؟</Bubble>
            <div className="self-center rounded-full bg-warn-soft px-3.5 py-1.5 text-sm font-semibold text-warn">13 ساعة بلا رد</div>
            <Bubble from="business" meta="10:14 ص">أهلا، الأسعار تختلف، تواصل معنا بالدوام.</Bubble>
            <div className="flex flex-col gap-2 border-t border-dashed border-line pt-3">
              <span className="text-sm font-semibold">تقييم Claude للمحادثة</span>
              <div className="flex flex-wrap gap-2">
                <Tag tone="warn">رد بطيء</Tag>
                <Tag tone="warn">لم يُعطِ سعراً</Tag>
                <Tag tone="warn">لم يطلب موعداً</Tag>
                <Tag tone="good">نبرة مهذبة</Tag>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
          <h2 className="text-3xl font-bold">ثلاث خطوات، بلا تركيب ولا برمجة</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="flex flex-col gap-2.5 rounded-2xl border border-line p-6">
                <span className="font-bold text-accent">{s.n}</span>
                <h3 className="text-xl font-semibold">{s.t}</h3>
                <p className="leading-8 text-[#4A5060]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
        <div>
          <h2 className="text-3xl font-bold">ابدأ مجاناً، وادفع حين ترى الفرق</h2>
          <p className="mt-2 text-[#4A5060]">الأسعار بالدولار شهرياً لكل فرع. الاشتراكات تُفتح بعد الإطلاق التجريبي.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`flex flex-col gap-3.5 rounded-2xl bg-surface p-7 ${p.featured ? "border-2 border-accent" : "border border-line"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                {p.featured && <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-white">الأكثر طلباً</span>}
              </div>
              <div className="text-4xl font-bold">{p.price}</div>
              <ul className="list-disc pr-5 leading-9 text-[#4A5060]">
                {p.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 py-7 text-sm text-muted">
        <span>مِرآة</span>
        <span>الخصوصية · الشروط · تواصل معنا</span>
      </footer>
    </div>
  );
}
