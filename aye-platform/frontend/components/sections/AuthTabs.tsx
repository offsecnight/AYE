"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoginForm }    from "@/components/forms/LoginForm";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { RecoverForm }  from "@/components/forms/RecoverForm";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "login" | "register" | "recover";

const tabs: { id: Tab; label: string }[] = [
  { id: "login",    label: "LOGIN" },
  { id: "register", label: "REGISTER" },
  { id: "recover",  label: "RECOVER" },
];

export function AuthTabs() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user }     = useAuthStore();
  const initialTab   = (searchParams.get("tab") as Tab) ?? "login";

  const [active, setActive] = useState<Tab>(
    tabs.some((t) => t.id === initialTab) ? initialTab : "login"
  );

  // ALL hooks must run unconditionally before any early return.
  // Redirect away if already authenticated — useEffect so it
  // never fires during the render phase (avoids the HotReload warning).
  useEffect(() => {
    if (!user) return;
    const dest = user.role === "DEV_SUPER_ADMIN" ? "/dev-admin" : "/campus/wall";
    router.replace(dest);
  }, [user, router]);

  // Reflect URL changes (browser back/forward)
  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && tabs.some((x) => x.id === t) && t !== active) {
      setActive(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Early return AFTER all hooks have been called
  if (user) return null;

  function switchTab(id: Tab) {
    setActive(id);
    router.replace(`/auth?tab=${id}`, { scroll: false });
  }

  return (
    <div>
      {/* TAB BAR */}
      <div className="flex border-3 border-ink mb-0 shadow-brutal">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "flex-1 py-3 font-mono font-bold text-xs uppercase tracking-widest",
              "border-r-2 border-ink last:border-r-0 transition-colors duration-75",
              active === t.id
                ? "bg-ink text-acid"
                : "bg-paper text-ink hover:bg-acid/20"
            )}
            aria-selected={active === t.id}
            role="tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="brute-card p-6" role="tabpanel">
        {active === "login"    && <LoginForm />}
        {active === "register" && <RegisterForm />}
        {active === "recover"  && <RecoverForm />}
      </div>
    </div>
  );
}
