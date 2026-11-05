"use client";

import { useState } from "react";
import { Key, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";

export function RecoverForm() {
  const [form,    setForm]    = useState({ ghost_handle: "", recovery_key: "", new_password: "" });
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authApi.recover({
        ghost_handle: form.ghost_handle.replace(/^@/, ""),
        recovery_key: form.recovery_key.toUpperCase(),
        new_password: form.new_password,
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="font-mono font-bold text-2xl text-emerald uppercase mb-2">
          ✓ RECOVERED
        </div>
        <p className="font-mono text-xs text-ink/60">
          Password updated. You can now log in with your new password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="border-3 border-ink bg-acid/10 p-3">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          📋 USE YOUR AYE RECOVERY KEYCARD — The 12-char code you downloaded at signup.
        </p>
      </div>

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
          RECOVERY KEY (XXX-XXX-XXX-XXX)
        </label>
        <input
          className="brute-input font-mono tracking-widest uppercase"
          placeholder="AY3-K9X-M2T-PQ7"
          value={form.recovery_key}
          onChange={set("recovery_key")}
          maxLength={15}
          required
          autoComplete="off"
        />
      </div>

      <div>
        <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
          NEW PASSWORD
        </label>
        <input
          type="password"
          className="brute-input"
          placeholder="Min 8 chars"
          value={form.new_password}
          onChange={set("new_password")}
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center"
      >
        {loading ? (
          <span className="animate-blink">RECOVERING...</span>
        ) : (
          <>
            <Key size={16} />
            RECOVER ACCOUNT
          </>
        )}
      </button>
    </form>
  );
}
