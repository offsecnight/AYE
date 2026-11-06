"use client";

import { useState, useRef } from "react";
import {
  ThumbsUp, Flag, Plus, Wrench, MessageSquare, MapPin, Users,
  X, Upload, FileText, CheckCircle, AlertCircle,
} from "lucide-react";
import { ExperiencePublic, experiencesApi } from "@/lib/api";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/ui/StatusBadge";
import { UnresolvedTimer } from "@/components/ui/Timer";
import { cn } from "@/lib/utils";
import { playAyeSound } from "@/lib/sounds";

const API_BASE = "/api/proxy";

interface Props {
  experience: ExperiencePublic;
  token:      string;
  onUpdate?:  () => void;
}

// ── Tiny file uploader (same pattern as CampaignBoard) ────────
async function uploadFiles(files: File[], token: string): Promise<{ storedName: string; originalName: string; mimeType: string; size: number }[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Upload failed");
  }
  const data = await res.json() as { files: { storedName: string; originalName: string; mimeType: string; size: number }[] };
  return data.files;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Inline Proof Panel ────────────────────────────────────────
function ProofPanel({ postId, token, onDone }: { postId: string; token: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files,     setFiles]   = useState<File[]>([]);
  const [comment,   setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done,      setDone]    = useState(false);
  const [error,     setError]   = useState<string | null>(null);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)].slice(0, 5));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    try {
      let proof_media_url: string | undefined;
      if (files.length > 0) {
        const uploaded = await uploadFiles(files, token);
        // pass as JSON string so backend stores storedName
        proof_media_url = JSON.stringify(uploaded);
      }
      await experiencesApi.crowdProof(postId, { proof_media_url, comment_text: comment || undefined }, token);
      setDone(true);
      setTimeout(onDone, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit proof");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="p-4 flex items-center gap-2 bg-emerald/10 border-t-2 border-emerald">
        <CheckCircle size={16} className="text-emerald" />
        <p className="font-mono text-xs text-emerald uppercase font-bold">PROOF SUBMITTED — THANKS!</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t-2 border-ink bg-paper p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">ADD CROWD PROOF</p>
        <button type="button" onClick={onDone} className="text-ink/40 hover:text-danger transition-colors" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 border-2 border-danger bg-danger/10">
          <AlertCircle size={12} className="text-danger shrink-0" />
          <p className="font-mono text-[10px] text-danger uppercase">{error}</p>
        </div>
      )}

      {/* File drop zone */}
      <div
        className="border-2 border-dashed border-ink/30 p-4 text-center cursor-pointer hover:border-acid hover:bg-acid/5 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(ev) => ev.preventDefault()}
        onDrop={(ev) => { ev.preventDefault(); addFiles(ev.dataTransfer.files); }}
      >
        <Upload size={16} className="mx-auto mb-1 text-ink/30" />
        <p className="font-mono text-[10px] text-ink/40 uppercase">
          ANY FILE TYPE — images, video, PDF, docs, audio, zip (max 5)
        </p>
      </div>
      <input ref={fileRef} type="file" multiple className="hidden"
        onChange={(e) => addFiles(e.target.files)} />

      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 border border-ink/20 bg-ink/5">
              <FileText size={10} className="text-ink/40 shrink-0" />
              <span className="font-mono text-[10px] flex-1 truncate">{f.name}</span>
              <span className="font-mono text-[10px] text-ink/30">{fmtBytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="text-danger hover:opacity-70"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="brute-input text-xs resize-none h-16"
        placeholder="Optional comment describing the proof..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button type="submit" disabled={uploading} className="btn-primary justify-center text-xs py-2">
        {uploading ? "UPLOADING..." : "SUBMIT PROOF"}
      </button>
    </form>
  );
}

// ── Inline Fix Panel ──────────────────────────────────────────
function FixPanel({ postId, token, onDone }: { postId: string; token: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files,     setFiles]   = useState<File[]>([]);
  const [note,      setNote]    = useState("");
  const [uploading, setUploading] = useState(false);
  const [done,      setDone]    = useState(false);
  const [error,     setError]   = useState<string | null>(null);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl)].slice(0, 5));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) { setError("At least one proof file is required for a fix proposal"); return; }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(files, token);
      await experiencesApi.proposeFix(postId, {
        fix_proof_media_url: JSON.stringify(uploaded),
        fix_note: note || undefined,
      }, token);
      setDone(true);
      setTimeout(onDone, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to propose fix");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="p-4 flex items-center gap-2 bg-emerald/10 border-t-2 border-emerald">
        <CheckCircle size={16} className="text-emerald" />
        <p className="font-mono text-xs text-emerald uppercase font-bold">FIX PROPOSED — COMMUNITY POLL STARTED!</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t-2 border-ink bg-paper p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald">PROPOSE A FIX</p>
        <button type="button" onClick={onDone} className="text-ink/40 hover:text-danger transition-colors" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <p className="font-mono text-[10px] text-ink/50 uppercase">
        Upload proof that the issue is resolved. A 48-hour community vote will begin.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-2 border-2 border-danger bg-danger/10">
          <AlertCircle size={12} className="text-danger shrink-0" />
          <p className="font-mono text-[10px] text-danger uppercase">{error}</p>
        </div>
      )}

      <div
        className="border-2 border-dashed border-emerald/40 p-4 text-center cursor-pointer hover:border-emerald hover:bg-emerald/5 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(ev) => ev.preventDefault()}
        onDrop={(ev) => { ev.preventDefault(); addFiles(ev.dataTransfer.files); }}
      >
        <Upload size={16} className="mx-auto mb-1 text-emerald/40" />
        <p className="font-mono text-[10px] text-ink/40 uppercase">
          FIX PROOF — any file type (max 5) <span className="text-danger">*</span>
        </p>
      </div>
      <input ref={fileRef} type="file" multiple className="hidden"
        onChange={(e) => addFiles(e.target.files)} />

      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 border border-ink/20 bg-ink/5">
              <FileText size={10} className="text-ink/40 shrink-0" />
              <span className="font-mono text-[10px] flex-1 truncate">{f.name}</span>
              <span className="font-mono text-[10px] text-ink/30">{fmtBytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                className="text-danger hover:opacity-70"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="brute-input text-xs resize-none h-16"
        placeholder="Describe how it was fixed..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button type="submit" disabled={uploading} className="btn-primary justify-center text-xs py-2 border-emerald bg-emerald text-white hover:opacity-90">
        {uploading ? "UPLOADING..." : "PROPOSE FIX + START VOTE"}
      </button>
    </form>
  );
}

// ── Main Card ─────────────────────────────────────────────────
export function ExperienceCard({ experience: e, token, onUpdate }: Props) {
  const [ayeCount,  setAye]     = useState(e.aye_count);
  const [ayeActive, setAyeAct]  = useState(false);
  const [flagged,   setFlagged] = useState(false);
  const [loadAye,   setLoadAye] = useState(false);
  const [loadJunk,  setLoadJnk] = useState(false);
  const [panel,     setPanel]   = useState<"proof" | "fix" | null>(null);

  const isResolved  = e.status === "RESOLVED";
  const isTrending  = e.status === "TRENDING";
  const displayName = e.hide_handle ? "Verified Campus Ghost" : `@${e.ghost_handle}`;

  async function handleAye() {
    if (loadAye) return;
    setLoadAye(true);
    const wasActive = ayeActive;
    setAyeAct(!wasActive);
    setAye((c) => wasActive ? c - 1 : c + 1);
    try {
      const res = await experiencesApi.aye(e.post_id, token) as { action: string; aye_count: number };
      setAye(res.aye_count);
      setAyeAct(res.action === "added");
      if (res.action === "added") playAyeSound();
      onUpdate?.();
    } catch {
      setAyeAct(wasActive);
      setAye((c) => wasActive ? c + 1 : c - 1);
    } finally {
      setLoadAye(false);
    }
  }

  async function handleJunk() {
    if (flagged || loadJunk) return;
    setLoadJnk(true);
    try {
      await experiencesApi.flagJunk(e.post_id, token);
      setFlagged(true);
      onUpdate?.();
    } catch {
      setFlagged(true);
    } finally {
      setLoadJnk(false);
    }
  }

  return (
    <article
      className={cn(
        "brute-card overflow-hidden",
        isTrending && "border-t-4 border-t-amber",
        isResolved && "border-t-4 border-t-emerald",
        e.severity === "CRITICAL" && !isResolved && "border-t-4 border-t-danger"
      )}
    >
      {/* CARD HEADER */}
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b-2 border-ink">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <CategoryBadge category={e.category} />
          <SeverityBadge severity={e.severity as "NORMAL" | "HIGH" | "CRITICAL"} />
          <StatusBadge status={e.status as "UNRESOLVED" | "TRENDING" | "FIX_PROPOSED" | "RESOLVED" | "HIDDEN_JUNK"} />
        </div>
        <button
          onClick={handleJunk}
          disabled={flagged || loadJunk}
          title="Flag as junk/joke"
          aria-label="Flag as junk"
          className={cn(
            "shrink-0 font-mono text-[10px] uppercase tracking-wider px-2 border-2 border-ink flex items-center gap-1 transition-colors min-h-[44px] min-w-[44px] justify-center",
            flagged ? "bg-ink text-acid" : "hover:bg-danger hover:text-white"
          )}
        >
          <Flag size={10} />
          <span className="hidden xs:inline">{flagged ? "FLAGGED" : "JUNK"}</span>
        </button>
      </div>

      {/* BODY */}
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink/60 truncate max-w-[60%]">
            {displayName}
          </span>
          {!isResolved ? (
            <UnresolvedTimer createdAt={e.created_at} />
          ) : (
            e.resolved_at && (
              <span className="font-mono text-xs font-bold text-emerald uppercase">✓ RESOLVED</span>
            )
          )}
        </div>

        <h2 className="font-mono font-bold text-base sm:text-lg leading-snug mb-4 uppercase break-words">
          {e.title}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border-2 border-ink p-3">
            <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-1">WHAT&apos;S WRONG</div>
            <p className="font-mono text-xs text-ink leading-relaxed line-clamp-3">{e.what_is_wrong}</p>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="border-2 border-ink p-3 flex gap-2">
              <MapPin size={14} className="shrink-0 mt-0.5 text-ink/40" />
              <div className="min-w-0">
                <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-0.5">LOCATION</div>
                <p className="font-mono text-xs font-bold break-words">{e.exact_location}</p>
              </div>
            </div>
            <div className="border-2 border-ink p-3 flex gap-2">
              <Users size={14} className="shrink-0 mt-0.5 text-ink/40" />
              <div className="min-w-0">
                <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-0.5">IMPACT</div>
                <p className="font-mono text-xs font-bold break-words">{e.impact_scope}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Media */}
        {Array.isArray(e.media_urls) && e.media_urls.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {(e.media_urls as string[]).slice(0, 3).map((url, i) => (
              <div key={i} className="border-2 border-ink aspect-video bg-ink/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INLINE PANELS */}
      {panel === "proof" && (
        <ProofPanel postId={e.post_id} token={token} onDone={() => { setPanel(null); onUpdate?.(); }} />
      )}
      {panel === "fix" && (
        <FixPanel postId={e.post_id} token={token} onDone={() => { setPanel(null); onUpdate?.(); }} />
      )}

      {/* ACTION BAR */}
      <div className="flex items-stretch border-t-2 border-ink divide-x-2 divide-ink">
        <button
          onClick={handleAye}
          disabled={loadAye}
          aria-pressed={ayeActive}
          className={cn(
            "flex items-center gap-2 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider flex-1 justify-center min-h-[48px] transition-colors duration-75",
            ayeActive ? "bg-acid text-ink" : "bg-paper text-ink"
          )}
        >
          <ThumbsUp size={14} />
          AYE! ({ayeCount})
        </button>

        {/* Add Proof — toggles inline panel */}
        {!isResolved && (
          <button
            onClick={() => setPanel(panel === "proof" ? null : "proof")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors min-h-[48px]",
              panel === "proof" ? "bg-ink text-acid" : "hover:bg-ink/5"
            )}
            aria-label="Add crowd proof"
            aria-expanded={panel === "proof"}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">PROOF</span>
          </button>
        )}

        {/* Propose Fix — toggles inline panel */}
        {!isResolved && (
          <button
            onClick={() => setPanel(panel === "fix" ? null : "fix")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors text-emerald min-h-[48px]",
              panel === "fix" ? "bg-ink text-acid" : "hover:bg-emerald/10"
            )}
            aria-label="Propose fix"
            aria-expanded={panel === "fix"}
          >
            <Wrench size={14} />
            <span className="hidden sm:inline">FIX</span>
          </button>
        )}

        {/* Issue Chat */}
        {isTrending && (
          <button
            className="flex items-center gap-1.5 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-amber/10 transition-colors text-amber min-h-[48px]"
            aria-label="Join issue chat"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">CHAT</span>
          </button>
        )}
      </div>
    </article>
  );
}
