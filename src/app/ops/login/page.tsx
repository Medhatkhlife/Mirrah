import { Suspense } from "react";
import { Card, Logo, btnPrimary, input } from "@/components/ui";
import { login } from "../actions";

async function LoginError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="text-sm text-warn">كلمة المرور غير صحيحة، أو لم تُضبط OPS_PASSWORD.</p>;
}

export default function OpsLogin(props: PageProps<"/ops/login">) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <Logo />
      <Card>
        <form action={login} className="flex flex-col gap-4">
          <h1 className="text-xl font-bold">دخول المشغّل</h1>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">كلمة المرور</span>
            <input name="password" type="password" required className={input} />
          </label>
          <Suspense fallback={null}>
            <LoginError searchParams={props.searchParams as Promise<{ error?: string }>} />
          </Suspense>
          <button className={btnPrimary}>دخول</button>
        </form>
      </Card>
    </div>
  );
}
