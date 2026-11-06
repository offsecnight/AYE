"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, AlertCircle } from "lucide-react";
import { ExperienceCard }       from "@/components/cards/ExperienceCard";
import { DropExperienceModal }  from "@/components/modals/DropExperienceModal";
import { CampaignBoard }        from "@/components/sections/CampaignBoard";
import { experiencesApi, ExperiencePublic } from "@/lib/api";
import { useAuthStore }         from "@/lib/store";
import { cn } from "@/lib/utils";

const STATUS_FILTERS   = ["ALL", "UNRESOLVED", "TRENDING", "FIX_PROPOSED", "RESOLVED"];
const CATEGORY_FILTERS = ["HOSTEL", "MESS_FOOD", "LABS_WIFI", "FEES_ADMIN", "FACULTY", "INFRASTRUCTURE", "SAFETY"];

export function CampusWall() {
  const { user } = useAuthStore();
  const router   = useRouter();

  const [experiences,    setExperiences] = useState<ExperiencePublic[]>([]);
  const [statusFilter,   setStatus]      = useState("ALL");
  const [categoryFilter, setCategory]    = useState<string | null>(null);
  const [sort,           setSort]        = useState<"ayes" | "newest" | "oldest_unresolved">("ayes");
  const [showDrop,       setDrop]        = useState(false);
  const [loading,        setLoading]     = useState(false);
  const [error,          setError]       = useState<string | null>(null);

  const fetchExperiences = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { sort };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (categoryFilter)         params.category = categoryFilter;
      const res = await experiencesApi.list(params, user.token) as { experiences: ExperiencePublic[] };
      setExperiences(res.experiences);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load experiences");
    } finally {
      setLoading(false);
    }
  }, [user?.token, statusFilter, categoryFilter, sort]);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    fetchExperiences();
  }, [user, fetchExperiences, router]);

  if (!user) return null;

  return (
    <div>
      {/* HEADER — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="section-label mb-2">CAMPUS / WALL</div>
          <h1 className="font-mono font-bold text-2xl sm:text-3xl uppercase">CAMPUS WALL</h1>
          <p className="font-mono text-xs text-ink/50 uppercase mt-1 truncate">
            @{user.ghost_handle} • {experiences.length} experiences
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchExperiences}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center border-3 border-ink bg-white shadow-brutal"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            className="btn-primary"
            onClick={() => setDrop(true)}
          >
            <Plus size={16} />
            <span className="hidden xs:inline">DROP </span>EXPERIENCE
          </button>
        </div>
      </div>

      {/* FILTER BAR — sticky below ticker (32px) + navbar (56px) */}
      <div className="sticky top-[88px] z-30 bg-paper border-b-3 border-ink -mx-4 px-4 py-3 mb-6">
        {/* Status row + sort */}
        <div className="flex gap-2 mb-2 flex-wrap items-center">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "chip-btn",
                statusFilter === s
                  ? "bg-ink text-acid"
                  : "bg-paper text-ink"
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
          <select
            className="ml-auto font-mono text-xs border-2 border-ink bg-paper px-2 uppercase min-h-[44px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            style={{ fontSize: "max(16px, 0.75rem)" }}
          >
            <option value="ayes">MOST AYES</option>
            <option value="newest">NEWEST</option>
            <option value="oldest_unresolved">OLDEST</option>
          </select>
        </div>

        {/* Category chips — scroll horizontally on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "chip-btn shrink-0",
              !categoryFilter ? "bg-acid text-ink" : "bg-paper text-ink"
            )}
          >
            ALL
          </button>
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === categoryFilter ? null : c)}
              className={cn(
                "chip-btn shrink-0",
                categoryFilter === c ? "bg-acid text-ink" : "bg-paper text-ink"
              )}
            >
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="brute-card p-4 mb-4 flex items-center gap-3 border-t-4 border-danger">
          <AlertCircle size={16} className="text-danger shrink-0" />
          <p className="font-mono text-sm text-danger uppercase flex-1 min-w-0 break-words">{error}</p>
          <button onClick={fetchExperiences} className="btn-secondary text-xs py-1 px-3 shrink-0">
            RETRY
          </button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex flex-col gap-5">
          {[1,2,3].map((i) => (
            <div key={i} className="brute-card p-6 h-48 animate-pulse bg-ink/5" />
          ))}
        </div>
      )}

      {/* FEED */}
      {!loading && (
        <div className="flex flex-col gap-5">
          {experiences.length === 0 ? (
            <div className="brute-card p-12 text-center">
              <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">
                NO EXPERIENCES MATCH THIS FILTER
              </p>
            </div>
          ) : (
            experiences.map((exp) => (
              <ExperienceCard
                key={exp.post_id}
                experience={exp}
                token={user.token}
                onUpdate={fetchExperiences}
              />
            ))
          )}
        </div>
      )}

      {/* DROP MODAL */}
      {showDrop && (
        <DropExperienceModal
          token={user.token}
          onClose={() => setDrop(false)}
          onSuccess={() => { setDrop(false); fetchExperiences(); }}
        />
      )}

      {/* ── CAMPAIGNS ─────────────────────────────────── */}
      <div className="mt-8">
        <CampaignBoard />
      </div>
    </div>
  );
}
