import Link from "next/link";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 text-ink no-underline">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="4" width="24" height="24" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M11 20 L21 10" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold">مِرآة</span>
    </Link>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function Tag({ tone, children }: { tone: "good" | "warn" | "neutral" | "accent"; children: React.ReactNode }) {
  const cls = {
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    neutral: "bg-line-soft text-muted",
    accent: "bg-accent-soft text-accent-dark",
  }[tone];
  return <span className={`inline-block rounded-lg px-2.5 py-1 text-sm ${cls}`}>{children}</span>;
}

export function Bubble({ from, children, meta }: { from: "customer" | "business"; children: React.ReactNode; meta?: string }) {
  const customer = from === "customer";
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-7 ${
        customer ? "self-start rounded-bl-md bg-accent-soft" : "self-end rounded-br-md bg-line-soft"
      }`}
    >
      <div className="whitespace-pre-wrap">{children}</div>
      {meta && <div className="mt-1 text-xs text-muted">{meta}</div>}
    </div>
  );
}

export function ScoreRing({ score, size = 110 }: { score: number | null; size?: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const s = score ?? 0;
  const color = s >= 70 ? "var(--color-good)" : s >= 50 ? "var(--color-warn-strong)" : "var(--color-warn)";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={score === null ? "لم تكتمل الدرجة بعد" : `درجة الاستجابة ${s} من 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line-soft)" strokeWidth="12" />
      {score !== null && (
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(c * s) / 100} ${c}`} transform="rotate(-90 60 60)"
        />
      )}
      <text x="60" y="68" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--color-ink)">
        {score === null ? "…" : s}
      </text>
    </svg>
  );
}

export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-dark disabled:opacity-60";
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#C9C6BC] bg-surface px-4 font-semibold text-ink hover:bg-line-soft";
export const input =
  "min-h-12 w-full rounded-xl border border-[#C9C6BC] bg-surface px-3.5 text-base text-ink placeholder:text-[#8a8f9c]";

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
    numberingSystem: "latn",
  }).format(new Date(iso));
}
