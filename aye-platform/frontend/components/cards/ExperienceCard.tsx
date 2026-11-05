"use client";

import { useState } from "react";
import {
  ThumbsUp, Flag, Plus, Wrench, MessageSquare, MapPin, Users,
} from "lucide-react";
import { ExperiencePublic, experiencesApi } from "@/lib/api";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/ui/StatusBadge";
import { UnresolvedTimer } from "@/components/ui/Timer";
import { cn } from "@/lib/utils";

interface Props {
  experience: ExperiencePublic;
  token:      string;
  onUpdate?:  () => void;
}

export function ExperienceCard({ experience: e, token, onUpdate }: Props) {
  const [ayeCount,  setAye]     = useState(e.aye_count);
  const [ayeActive, setAyeAct]  = useState(false);
  const [flagged,   setFlagged] = useState(false);
  const [loadAye,   setLoadAye] = useState(false);
  const [loadJunk,  setLoadJnk] = useState(false);

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
        {/* JUNK button — 44×44 minimum */}
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
        {/* Author + timer */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink/60 truncate max-w-[60%]">
            {displayName}
          </span>
          {!isResolved ? (
            <UnresolvedTimer createdAt={e.created_at} />
          ) : (
            e.resolved_at && (
              <span className="font-mono text-xs font-bold text-emerald uppercase">
                ✓ RESOLVED
              </span>
            )
          )}
        </div>

        {/* Title */}
        <h2 className="font-mono font-bold text-base sm:text-lg leading-snug mb-4 uppercase break-words">
          {e.title}
        </h2>

        {/* Structured fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border-2 border-ink p-3">
            <div className="font-mono text-[10px] text-ink/40 uppercase tracking-widest mb-1">
              WHAT'S WRONG
            </div>
            <p className="font-mono text-xs text-ink leading-relaxed line-clamp-3">
              {e.what_is_wrong}
            </p>
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

        {/* Media grid — 2 cols on mobile, 3 on sm+ */}
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

      {/* ACTION BAR — each button is min 44px tall */}
      <div className="flex items-stretch border-t-2 border-ink divide-x-2 divide-ink">
        {/* AYE button — always shows text */}
        <button
          onClick={handleAye}
          disabled={loadAye}
          aria-pressed={ayeActive}
          className={cn(
            "flex items-center gap-2 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider flex-1 justify-center min-h-[48px]",
            "transition-colors duration-75",
            ayeActive ? "bg-acid text-ink" : "bg-paper text-ink"
          )}
        >
          <ThumbsUp size={14} />
          AYE! ({ayeCount})
        </button>

        {/* Add Proof */}
        <button
          className="flex items-center gap-1.5 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-ink/5 transition-colors min-h-[48px]"
          aria-label="Add crowd proof"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">PROOF</span>
        </button>

        {/* Propose Fix */}
        {!isResolved && (
          <button
            className="flex items-center gap-1.5 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:bg-emerald/10 transition-colors text-emerald min-h-[48px]"
            aria-label="Propose fix"
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
