import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { AuthTabs }  from "@/components/sections/AuthTabs";

export default function AuthPage() {
  return (
    <PageShell>
      <div className="max-w-lg mx-auto py-10">
        <div className="section-label mb-6 inline-block">
          AUTH / ZERO-PII ONBOARDING
        </div>
        <h2 className="font-mono font-bold text-4xl uppercase mb-8">
          ENTER THE<br />
          <span className="bg-acid px-2 border-3 border-ink inline-block">
            GHOST NETWORK
          </span>
        </h2>
        <Suspense fallback={null}>
          <AuthTabs />
        </Suspense>
      </div>
    </PageShell>
  );
}
