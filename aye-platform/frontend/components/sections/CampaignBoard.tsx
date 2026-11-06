"use client";

/**
 * CampaignBoard — shown to students on the campus pages.
 * Lists active campaigns for their college and lets them upload a submission
 * with any file types, encrypted on the server.
 */

import { useState, useEffect, useRef } from "react";
import { Megaphone, Upload, FileText, X, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { BruteCard } from "@/components/ui/BruteCard";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const API_BASE = "/api/proxy";

async function apiCall(path: string, method = "GET", body?: object | FormData, token?: string) {
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "API error");
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────

interface Campaign {
  campaign_id:   string;
  title:         string;
  description:   string;
  reward_points: number;
  status:        string;
  starts_at:     string;
  ends_at:       string;
  _count:        { submissions: number };
}

interface UploadedFile {
  storedName:   string;
  originalName: string;
  mimeType:     string;
  size:         number;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:  <Clock size={12} />,
  APPROVED: <CheckCircle size={12} />,
  REJECTED: <XCircle size={12} />,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtBytes(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function daysLeft(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0)  return "ENDED";
  if (days === 0) return "ENDS TODAY";
  return `${days}D LEFT`;
}

// ── Main component ────────────────────────────────────────────

export function CampaignBoard() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!user?.token) return;
    setLoading(true);
    apiCall("/campaigns", "GET", undefined, user.token)
      .then((r) => setCampaigns((r as { campaigns: Campaign[] }).campaigns))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, [user?.token]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => <div key={i} className="brute-card h-24 animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <BruteCard className="p-4 flex items-center gap-2" accent="danger">
        <AlertCircle size={14} className="text-danger" />
        <p className="font-mono text-xs text-danger uppercase">{error}</p>
      </BruteCard>
    );
  }

  if (campaigns.length === 0) {
    return (
      <BruteCard className="p-6 text-center" accent="none">
        <Megaphone size={28} className="mx-auto mb-2 text-ink/20" />
        <p className="font-mono text-xs text-ink/40 uppercase">NO ACTIVE CAMPAIGNS FOR YOUR CAMPUS RIGHT NOW</p>
      </BruteCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {activeCampaign ? (
        <SubmitForm
          campaign={activeCampaign}
          token={user.token}
          onBack={() => setActiveCampaign(null)}
          onSuccess={() => setActiveCampaign(null)}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={14} className="text-acid" />
            <h3 className="font-mono font-bold text-sm uppercase">ACTIVE CAMPAIGNS</h3>
            <span className="font-mono text-[10px] bg-acid text-ink px-2 py-0.5 font-bold border-2 border-ink ml-1">
              {campaigns.length}
            </span>
          </div>
          {campaigns.map((c) => (
            <BruteCard key={c.campaign_id} className="p-4" accent="acid">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold bg-acid text-ink px-1.5 py-0.5 border-2 border-ink">
                      +{c.reward_points} PTS
                    </span>
                    <span className="font-mono text-[10px] text-ink/50 uppercase">{daysLeft(c.ends_at)}</span>
                  </div>
                  <h4 className="font-mono font-bold text-sm uppercase truncate">{c.title}</h4>
                  <p className="font-mono text-xs text-ink/60 mt-1 line-clamp-2">{c.description}</p>
                  <p className="font-mono text-[10px] text-ink/40 mt-1.5">
                    {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)} · {c._count.submissions} submissions
                  </p>
                </div>
                <button
                  onClick={() => setActiveCampaign(c)}
                  className="btn-primary shrink-0"
                >
                  <Upload size={12} />
                  SUBMIT REPORT
                </button>
              </div>
            </BruteCard>
          ))}
        </>
      )}
    </div>
  );
}

// ── Submission Form ───────────────────────────────────────────

function SubmitForm({
  campaign,
  token,
  onBack,
  onSuccess,
}: {
  campaign: Campaign;
  token:    string;
  onBack:   () => void;
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setSelectedFiles((prev) => {
      const combined = [...prev, ...arr];
      return combined.slice(0, 10); // max 10
    });
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    let uploadedFiles: UploadedFile[] = [];

    try {
      // 1. Upload files if any
      if (selectedFiles.length > 0) {
        const fd = new FormData();
        selectedFiles.forEach((f) => fd.append("files", f));
        const uploadRes = await apiCall("/upload", "POST", fd, token);
        uploadedFiles = (uploadRes as { files: UploadedFile[] }).files;
      }

      // 2. Submit campaign entry
      setUploading(false);
      setSubmitting(true);
      await apiCall(`/campaigns/${campaign.campaign_id}/submit`, "POST", {
        title,
        description,
        encrypted_files: uploadedFiles,
      }, token);

      setSuccess(true);
      setTimeout(onSuccess, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setUploading(false);
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <BruteCard className="p-8 text-center" accent="acid">
        <CheckCircle size={40} className="mx-auto mb-3 text-emerald" />
        <p className="font-mono font-bold text-lg uppercase text-emerald mb-1">SUBMITTED!</p>
        <p className="font-mono text-xs text-ink/60 uppercase">
          Your report is under review. You&apos;ll earn +{campaign.reward_points} points if approved.
        </p>
      </BruteCard>
    );
  }

  return (
    <div>
      {/* Back + campaign header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="btn-secondary py-1.5 px-3 font-mono text-xs">← BACK</button>
        <div>
          <p className="font-mono text-[10px] text-ink/40 uppercase">SUBMITTING TO</p>
          <p className="font-mono font-bold text-sm uppercase">{campaign.title}</p>
        </div>
        <span className="ml-auto font-mono text-xs font-bold bg-acid text-ink px-2 py-0.5 border-2 border-ink">
          +{campaign.reward_points} PTS ON APPROVAL
        </span>
      </div>

      {error && (
        <div className="brute-card p-3 mb-4 flex items-center gap-2 border-t-4 border-danger">
          <AlertCircle size={14} className="text-danger shrink-0" />
          <p className="font-mono text-xs text-danger uppercase">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">PROBLEM TITLE *</label>
          <input
            className="brute-input font-mono text-xs w-full"
            placeholder="Summarise the issue in one line..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required minLength={5} maxLength={140}
          />
        </div>

        {/* Description */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">DETAILED DESCRIPTION *</label>
          <textarea
            className="brute-input font-mono text-xs w-full min-h-[100px] resize-y"
            placeholder="Describe the problem in detail — what, where, how long, who is affected..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required minLength={20}
          />
        </div>

        {/* File upload */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-ink/50 block mb-1">
            EVIDENCE FILES — images, videos, PDFs, docs, audio, zip (max 10 files, 50 MB each)
          </label>

          {/* Drop zone */}
          <div
            className={cn(
              "border-3 border-dashed border-ink/30 p-6 text-center cursor-pointer transition-colors",
              "hover:border-acid hover:bg-acid/5"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <Upload size={20} className="mx-auto mb-2 text-ink/30" />
            <p className="font-mono text-xs text-ink/50 uppercase">
              DRAG & DROP OR CLICK TO SELECT
            </p>
            <p className="font-mono text-[10px] text-ink/30 mt-1">
              Supported: images, video, audio, PDF, Word, Excel, PowerPoint, text, ZIP
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*,text/plain,text/csv,application/zip"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* Selected file list */}
          {selectedFiles.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 border-2 border-ink/20 bg-ink/5">
                  <FileText size={12} className="text-ink/50 shrink-0" />
                  <span className="font-mono text-xs flex-1 truncate">{f.name}</span>
                  <span className="font-mono text-[10px] text-ink/40">{fmtBytes(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-danger hover:opacity-80 shrink-0"
                    aria-label="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <p className="font-mono text-[10px] text-ink/40 mt-1">
                {selectedFiles.length}/10 files · All files are encrypted before storage
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading || submitting}
            className="btn-primary flex-1 justify-center"
          >
            <Upload size={14} />
            {uploading ? "ENCRYPTING & UPLOADING..." : submitting ? "SUBMITTING..." : "SUBMIT REPORT"}
          </button>
          <button type="button" onClick={onBack} className="btn-secondary px-4">
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
}
