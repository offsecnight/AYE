"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { getHardwareFingerprint } from "@/lib/utils";

export function LoginForm() {
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [form,     setForm]     = useState({ ghost_handle: "", password: "" });

  const { setAuth } = useAuthStore();
  const router      = useRouter();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const fp = await getHardwareFingerprint();

      const res = await authApi.login({
        ghost_handle:              form.ghost_handle.replace(/^@/, ""),
        password:                  form.password,
        hardware_fingerprint_hash: fp,
      }) as {
        token: string;
        ghost_handle: string;
        college_id: string;
        role: string;
        trust_score: number;
        strike_count: number;
        account_status: string;
      };

      setAuth(
        {
          ghost_handle:   res.ghost_handle,
          college_id:     res.college_id,
          role:           res.role as "STUDENT" | "CAMPUS_MOD" | "DEV_SUPER_ADMIN",
          account_status: res.account_status as "ACTIVE" | "RESTRICTED" | "BANNED_TROLL",
          trust_score:    res.trust_score,
          strike_count:   res.strike_count,
          token:          res.token,
        },
        res.token
      );

      router.push("/campus/wall");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="border-3 border-danger bg-danger/10 p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="font-mono text-xs text-danger uppercase tracking-wide">{error}</p>
        </div>
      )}

      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
          GHOST HANDLE
        </label>
        <input
          className="brute-input"
          placeholder="@CyberWolf_99"
          value={form.ghost_handle}
          onChange={set("ghost_handle")}
          required
          autoComplete="username"
        />
      </div>

      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
          PASSWORD / PIN
        </label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            className="brute-input pr-12"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
            aria-label={showPass ? "Hide password" : "Show password"}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center mt-2"
      >
        {loading ? (
          <span className="animate-blink">AUTHENTICATING...</span>
        ) : (
          <>
            <LogIn size={16} />
            ENTER GHOST NETWORK
          </>
        )}
      </button>

      <p className="font-mono text-xs text-ink/50 text-center">
        No email. No real name. Just your ghost.
      </p>
    </form>
  );
}
