"use client";

import { useActionState } from "react";
import type { CoachState, PlaygroundState } from "@/lib/dashboard-actions";
import { Bubble, Tag, btnPrimary, btnSecondary, input } from "./ui";

export function AgentPlayground({ action }: { action: (s: PlaygroundState, f: FormData) => Promise<PlaygroundState> }) {
  const [state, run, pending] = useActionState(action, { reply: null, handoff: false, error: null });
  return (
    <form action={run} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">جرّب الوكيل كأنك زبون</span>
        <input name="message" placeholder="مرحبا، كم سعر الشقة 3 غرف؟" className={input} />
      </label>
      <button className={btnSecondary} disabled={pending}>{pending ? "يكتب…" : "أرسل للتجربة"}</button>
      {state.error && <p role="alert" className="text-sm text-warn">{state.error}</p>}
      {state.reply && (
        <div className="flex flex-col gap-2">
          <Bubble from="business">{state.reply}</Bubble>
          {state.handoff && <Tag tone="warn">حوّل الوكيل هذه المحادثة لموظف</Tag>}
        </div>
      )}
    </form>
  );
}

export function CoachPanel({ action }: { action: (s: CoachState) => Promise<CoachState> }) {
  const [state, run, pending] = useActionState(action, { mistakes: [], drill: null, error: null });
  return (
    <form action={run} className="flex flex-col gap-3">
      <button className={btnPrimary} disabled={pending}>{pending ? "يحلل المحادثات…" : "أعدّ تدريب هذا الأسبوع"}</button>
      {state.error && <p role="alert" className="text-sm text-warn">{state.error}</p>}
      {state.mistakes.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold">أخطاء متكررة</span>
          <ul className="list-disc pr-5 leading-8">{state.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {state.drill && (
        <p className="rounded-xl bg-accent-soft p-3 leading-7"><b>تمرين:</b> {state.drill}</p>
      )}
    </form>
  );
}
