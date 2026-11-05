"use client";

import { useState } from "react";
import { X, Upload, AlertTriangle, Eye, EyeOff, AlertCircle } from "lucide-react";
import { experiencesApi } from "@/lib/api";

interface Props {
  token:     string;
  onClose:   () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  "HOSTEL", "MESS_FOOD", "LABS_WIFI", "FEES_ADMIN",
  "FACULTY", "INFRASTRUCTURE", "SAFETY",
];
const SEVERITIES = ["NORMAL", "HIGH", "CRITICAL"];

export function DropExperienceModal({ token, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: "", category: "", severity: "NORMAL",
    what_is_wrong: "", exact_location: "", impact_scope: "",
    hide_handle: false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await experiencesApi.create(
        {
          title:          form.title,
          category:       form.category,
          severity:       form.severity,
          what_is_wrong:  form.what_is_wrong,
          exact_location: form.exact_location,
          impact_scope:   form.impact_scope,
          hide_handle:    form.hide_handle,
          media_urls:     [],
        },
        token
      );
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create experience");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} aria-hidden="true" />

      {/* Modal — bottom sheet on mobile, centered on sm+ */}
      <div
        className="relative w-full sm:max-w-xl overflow-y-auto scroll-touch brute-card shadow-brutal-lg
                   max-h-[92dvh] sm:max-h-[90vh] rounded-t-none sm:rounded-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drop-modal-title"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-ink/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink bg-ink text-acid">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-acid/60 mb-0.5">
              CAMPUS / WALL
            </div>
            <h3 id="drop-modal-title" className="font-mono font-bold text-base sm:text-lg uppercase">
              DROP AN EXPERIENCE
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-acid hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* SERIOUSNESS BANNER */}
        <div className="mx-4 mt-4 border-3 border-danger bg-danger/10 p-3 flex gap-3">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs font-bold text-danger uppercase tracking-wider mb-1">
              SERIOUSNESS POLICY
            </p>
            <p className="font-mono text-xs text-ink/70">
              Real problems only. Jokes = 1 Strike + Trust penalty. 2 strikes = hardware ban.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {error && (
            <div className="border-3 border-danger bg-danger/10 p-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-danger shrink-0" />
              <p className="font-mono text-xs text-danger uppercase tracking-wide break-words">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="exp-title" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
              TITLE <span className="text-danger">*</span>
            </label>
            <input
              id="exp-title"
              className="brute-input"
              placeholder="Describe the problem in one line (max 140)"
              maxLength={140}
              value={form.title}
              onChange={set("title")}
              required
            />
            <div className="text-right font-mono text-[10px] text-ink/30 mt-1">
              {form.title.length}/140
            </div>
          </div>

          {/* Category + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-cat" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                CATEGORY <span className="text-danger">*</span>
              </label>
              <select id="exp-cat" className="brute-input" value={form.category} onChange={set("category")} required>
                <option value="">Select...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="exp-sev" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                SEVERITY <span className="text-danger">*</span>
              </label>
              <select id="exp-sev" className="brute-input" value={form.severity} onChange={set("severity")} required>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* What's wrong */}
          <div>
            <label htmlFor="exp-wrong" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
              WHAT'S WRONG <span className="text-danger">*</span>
            </label>
            <textarea
              id="exp-wrong"
              className="brute-input resize-none h-24"
              placeholder="Describe the exact problem with facts (min 20 chars)..."
              value={form.what_is_wrong}
              onChange={set("what_is_wrong")}
              minLength={20}
              required
            />
          </div>

          {/* Location + Impact — stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-loc" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                EXACT LOCATION <span className="text-danger">*</span>
              </label>
              <input id="exp-loc" className="brute-input" placeholder="Block B, Lab 2" value={form.exact_location} onChange={set("exact_location")} required />
            </div>
            <div>
              <label htmlFor="exp-impact" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                IMPACT SCOPE <span className="text-danger">*</span>
              </label>
              <input id="exp-impact" className="brute-input" placeholder="150+ BCA students" value={form.impact_scope} onChange={set("impact_scope")} required />
            </div>
          </div>

          {/* Media upload */}
          <div>
            <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
              EVIDENCE MEDIA
            </label>
            <label className="brute-input flex items-center justify-center gap-2 cursor-pointer min-h-[64px] hover:bg-acid/10 transition-colors">
              <Upload size={18} className="text-ink/40 shrink-0" />
              <span className="font-mono text-xs text-ink/40 uppercase text-center">
                TAP TO UPLOAD — EXIF AUTO-STRIPPED
              </span>
              <input type="file" accept="image/*,video/*" multiple className="sr-only" tabIndex={-1} />
            </label>
          </div>

          {/* Hide handle toggle */}
          <div className="flex items-center justify-between border-2 border-ink p-3 gap-3">
            <div className="min-w-0">
              <div className="font-mono text-xs font-bold uppercase tracking-wider">
                HIDE MY GHOST HANDLE
              </div>
              <div className="font-mono text-[10px] text-ink/50 mt-0.5">
                Post as "Verified Campus Ghost"
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, hide_handle: !f.hide_handle }))}
              aria-pressed={form.hide_handle}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 border-2 border-ink font-mono text-xs font-bold uppercase transition-colors min-h-[44px] ${
                form.hide_handle ? "bg-ink text-acid" : "bg-paper text-ink"
              }`}
            >
              {form.hide_handle ? <EyeOff size={12} /> : <Eye size={12} />}
              {form.hide_handle ? "HIDDEN" : "VISIBLE"}
            </button>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn-danger w-full justify-center">
            {loading ? <span className="animate-blink">DROPPING...</span> : "DROP THIS EXPERIENCE"}
          </button>
        </form>
      </div>
    </div>
  );
}
