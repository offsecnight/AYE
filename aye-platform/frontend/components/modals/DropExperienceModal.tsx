"use client";

import { useState, useRef } from "react";
import { X, Upload, AlertTriangle, Eye, EyeOff, AlertCircle, FileText } from "lucide-react";
import { experiencesApi } from "@/lib/api";
import { playPostSuccessSound } from "@/lib/sounds";

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
const API_BASE   = "/api/proxy";

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

export function DropExperienceModal({ token, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", category: "", severity: "NORMAL",
    what_is_wrong: "", exact_location: "", impact_scope: "",
    hide_handle: false,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(fl)].slice(0, 10));
  }

  function removeFile(i: number) {
    setSelectedFiles((p) => p.filter((_, j) => j !== i));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 1. Upload files first (if any)
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        const fd = new FormData();
        selectedFiles.forEach((f) => fd.append("files", f));
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!uploadRes.ok) {
          const e = await uploadRes.json().catch(() => ({})) as { message?: string };
          throw new Error(e.message ?? "File upload failed");
        }
        const uploaded = await uploadRes.json() as { files: { storedName: string; originalName: string; mimeType: string }[] };
        // Store as download URLs the frontend can use
        mediaUrls = uploaded.files.map(
          (f) => `/api/proxy/files/${f.storedName}?mime=${encodeURIComponent(f.mimeType)}`
        );
      }

      // 2. Create the experience
      await experiencesApi.create(
        {
          title:          form.title,
          category:       form.category,
          severity:       form.severity,
          what_is_wrong:  form.what_is_wrong,
          exact_location: form.exact_location,
          impact_scope:   form.impact_scope,
          hide_handle:    form.hide_handle,
          media_urls:     mediaUrls,
        },
        token
      );
      playPostSuccessSound();
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

      {/* Modal */}
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
            <div className="text-[10px] font-mono uppercase tracking-widest text-acid/60 mb-0.5">CAMPUS / WALL</div>
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

        {/* Seriousness banner */}
        <div className="mx-4 mt-4 border-3 border-danger bg-danger/10 p-3 flex gap-3">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-xs font-bold text-danger uppercase tracking-wider mb-1">SERIOUSNESS POLICY</p>
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
            <div className="text-right font-mono text-[10px] text-ink/30 mt-1">{form.title.length}/140</div>
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
              WHAT&apos;S WRONG <span className="text-danger">*</span>
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

          {/* Location + Impact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp-loc" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                EXACT LOCATION <span className="text-danger">*</span>
              </label>
              <input id="exp-loc" className="brute-input" placeholder="Block B, Lab 2"
                value={form.exact_location} onChange={set("exact_location")} required />
            </div>
            <div>
              <label htmlFor="exp-impact" className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
                IMPACT SCOPE <span className="text-danger">*</span>
              </label>
              <input id="exp-impact" className="brute-input" placeholder="150+ BCA students"
                value={form.impact_scope} onChange={set("impact_scope")} required />
            </div>
          </div>

          {/* Evidence media — ALL file types */}
          <div>
            <label className="font-mono text-xs font-bold uppercase tracking-wider block mb-2">
              EVIDENCE MEDIA
              <span className="font-normal text-ink/40 ml-2 text-[10px]">images, video, audio, PDF, docs, zip — any type</span>
            </label>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-ink/30 p-5 text-center cursor-pointer hover:border-acid hover:bg-acid/5 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <Upload size={18} className="mx-auto mb-2 text-ink/30" />
              <span className="font-mono text-xs text-ink/40 uppercase">
                TAP TO UPLOAD OR DRAG & DROP — ENCRYPTED ON SERVER
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-2 border-ink/20 bg-ink/5">
                    <FileText size={11} className="text-ink/40 shrink-0" />
                    <span className="font-mono text-[10px] flex-1 truncate">{f.name}</span>
                    <span className="font-mono text-[10px] text-ink/30">{fmtBytes(f.size)}</span>
                    <button type="button" onClick={() => removeFile(i)}
                      className="text-danger hover:opacity-70 shrink-0" aria-label="Remove">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <p className="font-mono text-[10px] text-ink/30 text-right">{selectedFiles.length}/10 files</p>
              </div>
            )}
          </div>

          {/* Hide handle toggle */}
          <div className="flex items-center justify-between border-2 border-ink p-3 gap-3">
            <div className="min-w-0">
              <div className="font-mono text-xs font-bold uppercase tracking-wider">HIDE MY GHOST HANDLE</div>
              <div className="font-mono text-[10px] text-ink/50 mt-0.5">Post as "Verified Campus Ghost"</div>
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
            {loading ? (
              <span className="animate-blink">
                {selectedFiles.length > 0 ? "UPLOADING FILES..." : "DROPPING..."}
              </span>
            ) : "DROP THIS EXPERIENCE"}
          </button>
        </form>
      </div>
    </div>
  );
}
